import { createContext, useContext, useMemo, useState } from 'react'
import { currentUser } from './tripContent.js'

const TripAppContext = createContext(null)

export const useTripApp = () => useContext(TripAppContext)

const makeDefaultDate = (month, day) => new Date(2026, month, day)

const TRIPS_KEY = 'tripsync:createdTrips'
const loadCreatedTrips = () => {
  try {
    return JSON.parse(window.localStorage.getItem(TRIPS_KEY)) || []
  } catch {
    return []
  }
}

/* ————————————————————————————————————————————————
   三条路径的判定。先问「碰硬东西了吗」,再问「有人抢吗」。
     A 直接生效 + 匿名通知   没碰硬约束,也没人抢
     B 决策回合             没碰硬约束,但这个时段已经有人提过
     C 冲突对话             碰了硬约束(已预订 / Required / 预算上限 / 日期范围)
   后端接管后,这个函数应由 Constraint Engine 实现,前端只消费结果。
———————————————————————————————————————————————— */

const REQUIRED_EARLIEST_HOUR = 9 // 组内某成员的 Required:不安排早于 9:00 的活动

const parseHour = text => {
  const match = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i.exec(text || '')
  if (!match) return null
  const hour = Number(match[1]) % 12
  return /p/i.test(match[3]) ? hour + 12 : hour
}

export const classifyChange = ({ item, actionType, request, contestedSlots = [] }) => {
  const hour = parseHour(request)
  // 每一条判据都单独返回,让用户看得见"为什么是这条路径",而不是只看到结论。
  // 顺序 = 判定顺序:任何一条 hard 命中就是路径 C,否则看 contested,否则路径 A。
  const checks = [
    {
      id: 'booking',
      label: 'Confirmed booking on this item',
      hit: Boolean(item.locked || item.status === 'Booked'),
      kind: 'hard',
    },
    {
      id: 'required',
      label: 'Required constraint of a member',
      hit: hour !== null && hour < REQUIRED_EARLIEST_HOUR,
      kind: 'hard',
      privateNote: 'One member has a required constraint here. Who they are and why stays private.',
    },
    {
      id: 'contested',
      label: 'Someone else already asked about this slot',
      hit: contestedSlots.includes(item.id),
      kind: 'contested',
    },
  ]
  const hardHit = checks.find(check => check.kind === 'hard' && check.hit)
  if (hardHit) {
    return {
      path: 'C', checks,
      headline: hardHit.id === 'booking' ? 'This touches a confirmed booking' : 'This breaks a required constraint',
      detail: hardHit.id === 'booking'
        ? 'A shared reservation is attached to this item, so every affected member has to confirm before the Current Plan changes.'
        : 'One member has a required constraint that this time would violate. The reason and the member stay private.',
    }
  }
  if (checks.find(check => check.id === 'contested').hit) {
    return {
      path: 'B', checks,
      headline: 'Someone already has a different idea for this slot',
      detail: 'Rather than negotiating one-on-one, everyone weighs in at once and the slot is settled in a single round.',
    }
  }
  return {
    path: 'A', checks,
    headline: 'No conflict — this can apply now',
    detail: 'Nothing hard is affected and nobody else has asked about this slot. It applies immediately and the group just gets a notice.',
  }
}

/* —— 路径 A:直接改 —— */
const patchFor = (actionType, item, request) => {
  switch (actionType) {
    case 'editTime':
      return { time: '3:30 PM', note: request || 'Later start, same place and same day.' }
    case 'moveDay':
      return { time: '1:00 PM', dayNote: 'Moved to Day 3', note: request || 'Same activity, moved to a lighter day.' }
    case 'replacePlace':
      return { title: 'Park + café break', place: 'Near Millennium Park', time: '2:30 PM', note: request || 'Lower-walking option nearby.' }
    case 'removePlan':
      return { title: 'Free time', place: 'No booking held', time: '—', note: request || 'This stop was dropped; the rest of the day is unchanged.' }
    default:
      return { note: request || '' }
  }
}

/* —— 路径 B:决策回合的候选项。必须包含「分头行动」—— */
const roundOptionsFor = (item, request) => [
  { id: 'keep', label: 'Keep current', title: item.title, body: `Stay with ${item.place} exactly as planned.` },
  { id: 'requested', label: 'New idea', title: request?.slice(0, 60) || 'The newly suggested plan', body: 'Switch this block to the option raised most recently.' },
  { id: 'split', label: 'Split up', title: 'Split for this block', body: 'Both options run in parallel and the group regroups afterwards.' },
]

/* —— 路径 C:提案。发起人默认已同意;其他成员一律匿名 —— */
const anonLabels = ['Member A', 'Member B', 'Member C']

const afterStateFor = (actionType, item, request) => {
  const patch = patchFor(actionType, item, request)
  return { title: patch.title || item.title, time: patch.time || item.time, place: patch.place || item.place, dayLabel: patch.dayNote || item.dayLabel, note: patch.note }
}

const createProposal = ({ item, actionType, request, classification }) => ({
  id: `proposal-${Date.now()}`,
  sourceItemId: item.id,
  actionType,
  status: 'waiting_affected_members',
  createdAt: '10:44 AM',
  headline: classification.headline,
  detail: classification.detail,
  before: { title: item.title, time: item.time, place: item.place, dayLabel: item.dayLabel, note: item.note },
  after: afterStateFor(actionType, item, request),
  // requester 是当前用户,显示为 You;其余成员匿名,连姓名都不进前端
  affectedMembers: [
    { id: 'self', label: 'You', status: 'accepted', proposer: true },
    { id: 'other-1', label: anonLabels[0], status: 'pending' },
  ],
  privacyNote: 'Everyone in this conversation is anonymous. Names and private reasons are never shown.',
})

export function TripAppProvider({ children }) {
  const [appliedPatches, setAppliedPatches] = useState({})
  const [contestedSlots, setContestedSlots] = useState([])
  const [notices, setNotices] = useState([])
  const [activeRound, setActiveRound] = useState(null)
  const [activeProposal, setActiveProposal] = useState(null)
  const [decisionResolved, setDecisionResolved] = useState(false)
  const [updateFilter, setUpdateFilter] = useState('actions')
  const [toast, setToast] = useState('')
  const [trips, setTrips] = useState(loadCreatedTrips)
  const [inviteCopied, setInviteCopied] = useState(false)
  // 哪些 trip 已经收到当前用户的偏好。真实场景由 GET /api/trips/:id/members 给出全组进度。
  const [preferencesSubmittedFor, setPreferencesSubmittedFor] = useState([])
  const [preferences, setPreferences] = useState({
    preferredRange: { start: makeDefaultDate(7, 14), end: makeDefaultDate(7, 17) },
    availableRange: { start: makeDefaultDate(7, 13), end: makeDefaultDate(7, 18) },
    idealBudget: '$500',
    maxBudget: '$650',
    budgetVisibility: 'organizer',
    pace: 'Relaxed',
    interests: ['Food', 'Culture', 'Relaxed'],
    essentialNeeds: [
      { id: 'need-1', text: 'No activities before 9:00 AM', importance: 'required', visibility: 'planning' },
    ],
    avoid: 'Very crowded nightlife venues',
  })

  const notify = message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2400)
  }

  const persistTrips = next => {
    window.localStorage.setItem(TRIPS_KEY, JSON.stringify(next))
    return next
  }

  const addTrip = data => {
    const created = { id: `trip-${Date.now()}`, isCreated: true, status: 'Planning', ...data }
    setTrips(current => persistTrips([created, ...current]))
    return created
  }

  const addNotice = notice => setNotices(current => [{ id: `notice-${Date.now()}`, time: 'Just now', ...notice }, ...current])

  // 路径 A:立即写入 Current Plan,只发匿名通知,不要求任何人操作
  const applyDirectChange = ({ item, actionType, request }) => {
    const patch = patchFor(actionType, item, request)
    setAppliedPatches(current => ({ ...current, [item.id]: patch }))
    setContestedSlots(current => current.includes(item.id) ? current : [...current, item.id])
    addNotice({
      kind: 'plan',
      icon: '↻',
      title: `${item.title} was updated`,
      body: 'Applied directly — nothing hard was affected and nobody else had asked about this slot. Say something if it does not work for you.',
      itemId: item.id,
      canObject: true,
    })
    return patch
  }

  // 路径 B:开一轮全员并行表态,有截止时间,沉默不阻塞
  const openDecisionRound = ({ item, request, totalMembers = 6 }) => {
    const windowMs = 2 * 60 * 60 * 1000 // Traveling 状态 2 小时;Planning 状态应为 24 小时
    const round = {
      id: `round-${Date.now()}`,
      itemId: item.id,
      itemTitle: item.title,
      options: roundOptionsFor(item, request),
      votes: {},
      totalMembers,
      openedAt: Date.now(),
      closesAt: Date.now() + windowMs,
      windowMs,
      status: 'open',
      winningOptionId: null,
    }
    setActiveRound(round)
    setContestedSlots(current => current.includes(item.id) ? current : [...current, item.id])
    return round
  }

  // 当前用户投票,其余成员的票随后陆续到达(demo 模拟),到齐即落地
  const castVote = optionId => {
    setActiveRound(current => {
      if (!current || current.status !== 'open') return current
      return { ...current, votes: { ...current.votes, [currentUser.id]: optionId } }
    })
    // demo:模拟其他成员陆续投票。真实场景由各自客户端提交,到截止时间由服务端结算。
    window.setTimeout(() => {
      setActiveRound(current => {
        if (!current || current.status !== 'open') return current
        const votes = { ...current.votes, 'm2': optionId, 'm3': 'split', 'm4': optionId }
        const tally = Object.values(votes).reduce((acc, id) => ({ ...acc, [id]: (acc[id] || 0) + 1 }), {})
        const winningOptionId = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0]
        const winner = current.options.find(option => option.id === winningOptionId)
        setAppliedPatches(patches => ({ ...patches, [current.itemId]: { title: winner.title, note: `Settled by a group round — ${Object.keys(votes).length} of ${current.totalMembers} took part.` } }))
        addNotice({
          kind: 'plan',
          icon: '✓',
          title: `${current.itemTitle} was settled by a group round`,
          body: `“${winner.title}” had the most support. Members who did not respond are recorded as no preference, not as agreement.`,
        })
        return { ...current, votes, status: 'closed', winningOptionId }
      })
      notify('Round closed — Current Plan updated')
    }, 2600)
  }

  // 路径 C:提案,受影响成员逐个确认,确认齐了才写入 Current Plan
  const createChangeProposal = ({ item, actionType, request, classification }) => {
    const proposal = createProposal({ item, actionType, request, classification })
    setActiveProposal(proposal)
    setDecisionResolved(false)
    setUpdateFilter('actions')
    return proposal
  }

  const resolveProposal = () => {
    setActiveProposal(current => {
      if (!current) return current
      setAppliedPatches(patches => ({ ...patches, [current.sourceItemId]: { title: current.after.title, time: current.after.time, place: current.after.place, note: current.after.note } }))
      return { ...current, status: 'applied_to_current_plan', affectedMembers: current.affectedMembers.map(member => ({ ...member, status: 'accepted' })) }
    })
    setDecisionResolved(true)
  }

  const withdrawProposal = () => {
    setActiveProposal(null)
    setDecisionResolved(false)
  }

  // 路径 A 的通知上点「我有别的想法」→ 升级为路径 B
  const objectToNotice = notice => {
    const item = { id: notice.itemId, title: notice.title.replace(' was updated', ''), place: 'the current spot' }
    setNotices(current => current.map(n => n.id === notice.id ? { ...n, canObject: false, body: 'Escalated to a group round after an objection.' } : n))
    return openDecisionRound({ item, request: 'A different idea for this block' })
  }

  const resetDemo = () => {
    setAppliedPatches({})
    setContestedSlots([])
    setNotices([])
    setActiveRound(null)
    setActiveProposal(null)
    setDecisionResolved(false)
  }

  const value = useMemo(() => ({
    appliedPatches, contestedSlots, notices,
    activeRound, activeProposal, decisionResolved,
    conflictCreated: !!activeProposal,
    classify: payload => classifyChange({ ...payload, contestedSlots }),
    applyDirectChange, openDecisionRound, castVote,
    createChangeProposal, resolveProposal, withdrawProposal,
    objectToNotice, resetDemo,
    updateFilter, setUpdateFilter,
    trips, addTrip,
    inviteCopied, setInviteCopied,
    preferences, setPreferences,
    preferencesSubmittedFor,
    submitPreferencesFor: tripId => setPreferencesSubmittedFor(current => current.includes(tripId) ? current : [...current, tripId]),
    notify,
  }), [appliedPatches, contestedSlots, notices, activeRound, activeProposal, decisionResolved, updateFilter, trips, inviteCopied, preferences, preferencesSubmittedFor])

  return <TripAppContext.Provider value={value}>{children}{toast && <div className="toast">{toast}</div>}</TripAppContext.Provider>
}
