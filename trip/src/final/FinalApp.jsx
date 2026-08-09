import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { TripAppProvider, useTripApp } from './TripAppState.jsx'
import { baseUpdates, currentUser, guestDraft, initialComments, initialDays, otherTrips, personalUpdates, routeSegments, trip, tripMembers, tripStyles } from './tripContent.js'
import TripMap from './TripMap.jsx'

const visibleStatus = status => ['Booked', 'Updated'].includes(status) ? status : ''
const statusTone = status => status === 'Booked' ? 'purple' : status === 'Updated' ? 'green' : 'blue'

const calendarMonths = [
  { label: 'August 2026', month: 7 },
  { label: 'September 2026', month: 8 },
]
const dayKey = date => date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : ''
const sameDay = (a, b) => a && b && dayKey(a) === dayKey(b)
const isBefore = (a, b) => a.getTime() < b.getTime()
const isWithin = (day, range) => range.start && range.end && !isBefore(day, range.start) && !isBefore(range.end, day)
const nightsBetween = range => range.start && range.end ? Math.max(0, Math.round((range.end - range.start) / 86400000)) : 0
const formatShortDate = date => date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Select'
const formatDateRange = range => range.start && range.end ? `${formatShortDate(range.start)} – ${formatShortDate(range.end)}, 2026` : 'Select dates'

const logoMarkSrc = `${import.meta.env.BASE_URL}images/cadensy-mark.png`
const logoWordmarkSrc = `${import.meta.env.BASE_URL}images/cadensy-wordmark.png`

const pathLabels = {
  A: 'Applies now',
  B: 'Goes to a group round',
  C: 'Needs confirmation',
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

// 弹层通用:点击外部即关闭
function useClickOutside(active, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!active) return
    const handle = event => {
      if (ref.current && !ref.current.contains(event.target)) onClose()
    }
    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  }, [active, onClose])
  return ref
}

// 路由里的 tripId 命中用户创建的 trip 时返回它,否则回落到芝加哥演示 trip
function useCurrentTrip() {
  const { tripId } = useParams()
  const app = useTripApp()
  return app.trips.find(item => item.id === tripId) || trip
}

function DateRangePicker({ value, onChange }) {
  const chooseDay = day => {
    if (!value.start || value.end) return onChange({ start: day, end: null })
    if (isBefore(day, value.start)) return onChange({ start: day, end: value.start })
    onChange({ start: value.start, end: day })
  }
  return <div className="rangeCalendar">
    <div className="rangeCalendarSummary"><div><span>Trip dates</span><strong>{formatDateRange(value)}</strong></div><small>{value.start && value.end ? `${nightsBetween(value)} nights` : 'Choose a start and end date'}</small></div>
    <div className="calendarMonths">{calendarMonths.map(month => {
      const first = new Date(2026, month.month, 1).getDay()
      const count = new Date(2026, month.month + 1, 0).getDate()
      return <section className="calendarMonth" key={month.label}><h3>{month.label}</h3><div className="weekdayRow">{['S','M','T','W','T','F','S'].map((d,i) => <span key={`${d}-${i}`}>{d}</span>)}</div><div className="calendarGrid">
        {Array.from({ length: first }, (_, i) => <span className="calendarBlank" key={`b-${i}`}/>) }
        {Array.from({ length: count }, (_, i) => { const day = new Date(2026, month.month, i + 1); return <button type="button" key={dayKey(day)} className={cx(sameDay(day,value.start) && 'rangeStart', sameDay(day,value.end) && 'rangeEnd', isWithin(day,value) && 'inRange')} onClick={() => chooseDay(day)}>{i + 1}</button> })}
      </div></section>
    })}</div>
  </div>
}

const cx = (...classes) => classes.filter(Boolean).join(' ')

function BrandLogo({ showWordmark = true }) {
  return <span className="brandLogo">
    <img className="brandLogoMark" src={logoMarkSrc} alt="CADENSY mark" />
    {showWordmark && <img className="brandLogoWordmark" src={logoWordmarkSrc} alt="CADENSY" />}
  </span>
}

function Logo() {
  return <Link to="/" className="logo" aria-label="CADENSY home"><BrandLogo /></Link>
}

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Button({ children, secondary, ghost, className, ...props }) {
  return <button className={cx('btn', secondary && 'btnSecondary', ghost && 'btnGhost', className)} {...props}>{children}</button>
}

function CustomSelect({ label, value, options, onChange, className }) {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  const selected = options.find(option => option.value === value) || options[0]
  return <div className={cx('customSelectField', className)} ref={ref}>
    <label>{label}</label>
    <button type="button" className={cx('customSelectButton', open && 'open')} onClick={() => setOpen(current => !current)}>
      <span>{selected.label}</span>
      <i aria-hidden="true">⌄</i>
    </button>
    {open && <div className="customSelectMenu">
      {options.map(option => <button type="button" key={option.value} className={cx(option.value === value && 'selected')} onClick={() => { onChange(option.value); setOpen(false) }}>
        <span>{option.label}</span>
        {option.value === value && <b>✓</b>}
      </button>)}
    </div>}
  </div>
}

function Account() {
  return <div className="account"><ProfileMenu/></div>
}

function ActionBell() {
  const app = useTripApp()
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  const actions = []
  if (app.activeRound?.status === 'open') actions.push({ trip: trip.name, text: 'A group round is open — pick an option', to: `/trip/${trip.id}/updates` })
  if (app.conflictCreated && !app.decisionResolved) actions.push({ trip: trip.name, text: 'A proposal is waiting for confirmation', to: `/trip/${trip.id}/updates` })
  return <div className="actionBellWrap" ref={ref}>
    <button className={cx('actionBell', actions.length && 'hasActions')} type="button" onClick={() => setOpen(current => !current)} aria-label="Action inbox">🔔</button>
    {open && <div className="actionInbox">
      <div className="actionInboxHead"><span>Actions</span><small>{actions.length ? `${actions.length} waiting` : 'Clear'}</small></div>
      {actions.length === 0 && <div className="actionInboxEmpty">No trip actions right now.</div>}
      {actions.map(action => <Link key={action.text} to={action.to} className="actionInboxItem">
        <strong>{action.trip}</strong>
        <span>{action.text}</span>
      </Link>)}
      {actions.length > 0 && <Link className="actionInboxFooter" to={`/trip/${trip.id}/updates`}>Open trip actions →</Link>}
    </div>}
  </div>
}

function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  return <div className="profileMenuWrap" ref={ref}>
    <button className="profileButton" type="button" onClick={() => setOpen(current => !current)} aria-label="Profile menu">{currentUser.initials}</button>
    {open && <div className="profileMenu">
      <div className="profileMenuHead"><span className="profilePhoto">{currentUser.initials}</span><div><strong>{currentUser.name}</strong><small>{currentUser.email}</small></div></div>
      <button type="button"><span>◌</span> Profile</button>
      <button type="button"><span>✈</span> Travel profile</button>
      <button type="button"><span>🔔</span> Notifications</button>
      <button type="button"><span>◍</span> Privacy</button>
      <button type="button"><span>☾</span> Appearance</button>
      <button type="button"><span>⚙</span> Settings</button>
      <button type="button"><span>↪</span> Sign out</button>
    </div>}
  </div>
}

const cardPhotos = ['photoLake', 'photoMountain', 'photoNight', 'photoChicago']

function DashboardCard({ title, location, dates, status, tone, imageClass, detail, to }) {
  return <Link className="dashboardTripCard" to={to || `/trip/${trip.id}/plan`}>
    <div className={`tripPhoto ${imageClass}`}><Badge tone={tone}>{status}</Badge></div>
    <div className="dashboardTripBody">
      <div className="tripTitle"><h2>{title}</h2>{detail && <span className="attentionDot">{detail}</span>}</div>
      <p>{location} · {dates}</p>
      <div className="cardFooter"><span>{detail || 'Open current plan'}</span><strong>Open →</strong></div>
    </div>
  </Link>
}

function ActivityPhoto({ item }) {
  const [failed, setFailed] = useState(false)
  if (!item.photoUrl || failed) return <div className="activityPhoto activityPhotoFallback"><span>Photo</span></div>
  return <div className="activityPhoto"><img src={item.photoUrl} alt="" loading="lazy" onError={() => setFailed(true)}/></div>
}

function Home() {
  const app = useTripApp()
  // Guest 没有账户,也就没有跨 trip 的仪表盘。直连过来就送回他所在的那趟旅行。
  if (currentUser.role === 'guest') return <Navigate to={`/trip/${trip.id}/plan`} replace/>
  const roundOpen = app.activeRound?.status === 'open'
  const proposalPending = app.conflictCreated && !app.decisionResolved
  return <main className="homePage">
    <header className="editorialNav"><Logo/><nav><Link className="active" to="/">MY TRIPS</Link><Link to="/create">NEW TRIP</Link></nav><div className="editorialActions"><ActionBell/><ProfileMenu/></div></header>
    <section className="homeContent">
      <div className="dashboardMasthead">
        <div><span className="eyebrow">My trips</span><h1>Upcoming trips</h1><p>Pick up where the group left off.</p></div>
      </div>
      <Link className="createTripStrip featureCreateTrip" to="/create"><div><span className="roleChip">Create new trip</span><h2>Start a group trip frame</h2><p>Choose destination, dates, budget, and invite people when the frame is ready.</p></div><strong>New trip →</strong></Link>
      {roundOpen && <Link className="dashboardAlert" to={`/trip/${trip.id}/updates`}><span>◇</span><div><strong>A group round is open</strong><p>One block is contested. Pick an option — it closes on its own.</p></div><b>Choose →</b></Link>}
      {proposalPending && <Link className="dashboardAlert" to={`/trip/${trip.id}/updates`}><span>!</span><div><strong>A proposal is waiting for confirmation</strong><p>The current plan stays active until the affected members accept.</p></div><b>Review →</b></Link>}
      <section className="dashboardGrid">
        {app.trips.map((created, index) => <DashboardCard key={created.id} title={created.name} location={created.destination} dates={created.dates} status="Planning" tone="orange" imageClass={cardPhotos[index % cardPhotos.length]} detail="Ready to plan" to={`/trip/${created.id}/plan`}/>)}
        <DashboardCard title={trip.name} location="Chicago" dates="Aug 14–17" status="Traveling" tone="purple" imageClass="photoChicago" detail={roundOpen ? 'Round open' : proposalPending ? 'Awaiting confirmation' : 'Today · 2:00 PM next'} />
        {otherTrips.map(other => <DashboardCard key={other.id} title={other.name} location={other.destination} dates={other.dates} status={other.status} tone={other.tone} imageClass={other.photo} detail={other.detail}/>)}
      </section>
    </section>
  </main>
}

function TripShell({ children }) {
  const location = useLocation()
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const isDemoTrip = currentTrip.id === trip.id
  let pending = 0
  if (isDemoTrip && app.activeRound?.status === 'open') pending += 1
  if (isDemoTrip && app.conflictCreated && !app.decisionResolved) pending += 1
  const segment = location.pathname.split('/').filter(Boolean).pop()
  const active = segment === 'conflict' ? 'chat' : segment
  // 组织者不是超级用户,只是多了几个「维护公共框架」的入口。
  // Plan / Chat / Updates / Preferences 三种角色完全一致。
  const isOrganizer = currentUser.role === 'organizer'
  const isGuest = currentUser.role === 'guest'
  return <div className="tripPage">
    <header className="tripUnifiedHeader">
      {/* trip 页里 logo 和「My Trips」原本是两个指向同一处的链接,合并成一个返回入口 */}
      <div className="tripUnifiedBrand">
        {isGuest
          ? <span className="brandBack" aria-label="CADENSY"><BrandLogo /></span>
          : <Link className="brandBack" to="/"><BrandLogo showWordmark={false} /><span className="backArrow">&larr;</span><span>My Trips</span></Link>}
      </div>
      <div className="tripUnifiedCenter">
        <div className="tripUnifiedTitleRow"><h1>{currentTrip.name}</h1><nav className="tripUnifiedTabs">
          <Link className={active === 'plan' ? 'active' : ''} to={`/trip/${currentTrip.id}/plan`}>Plan</Link>
          <Link className={active === 'chat' ? 'active' : ''} to={`/trip/${currentTrip.id}/chat`}>Chat</Link>
          <Link className={active === 'updates' ? 'active' : ''} to={`/trip/${currentTrip.id}/updates`}>Updates{pending > 0 && <i>{pending}</i>}</Link>
          <Link className={active === 'preferences' ? 'active' : ''} to={`/trip/${currentTrip.id}/preferences`}>Preferences</Link>
          {isOrganizer && <Link className={active === 'members' ? 'active' : ''} to={`/trip/${currentTrip.id}/members`}>Members</Link>}
          {isOrganizer && <Link className={active === 'invite' ? 'active' : ''} to={`/trip/${currentTrip.id}/invite`}>Invite</Link>}
        </nav></div>
      </div>
      <div className="tripUnifiedRight">
        {isGuest ? <SaveToAccount/> : <Account/>}
      </div>
    </header>
    <main className="workspaceContent">
      <TripPill trip={currentTrip} role={currentUser.role}/>
      {children}
    </main>
  </div>
}

/* 行程元信息胶囊。原本贴在顶栏最上方,信息又长又碎;
   改成灵动岛式的深色胶囊,放进内容区顶部,只留最少的字。 */
function TripPill({ trip: t, role }) {
  const city = (t.destination || '').split(',')[0].trim()
  const dates = (t.dates || '').replace(/,?\s*\d{4}$/, '')
  return <div className="tripPill">
    <span className="pillDot" aria-hidden="true"/>
    <span className="pillStatus">{t.status}</span>
    <i/>
    <span>{city}</span>
    <i/>
    <span>{dates}</span>
    <i/>
    <span>{t.people}</span>
    {role !== 'participant' && <><i/><span className="pillRole">{role === 'guest' ? 'Guest' : 'Organizer'}</span></>}
  </div>
}

// Guest 绑定账户:保留原 membership,不新建成员,已提交的偏好不丢
function SaveToAccount() {
  const app = useTripApp()
  return <Button secondary onClick={() => app.notify('Account signup connects to the backend later — your membership and preferences carry over')}>Save to account</Button>
}

// 组织者专属。只显示「加没加入 / 交没交偏好」,永远不显示偏好内容。
function MembersPage() {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  // 新建的 trip 还没有别人加入,名单应该只有创建者 + 若干未加入的空位,
  // 不能复用演示 trip 的六人名单。
  const roster = currentTrip.isCreated
    ? [
        { id: currentUser.id, name: currentUser.name, initials: currentUser.initials, role: 'organizer', joined: true, preferencesSubmitted: app.preferencesSubmittedFor.includes(currentTrip.id) },
        ...Array.from({ length: Math.max(0, (currentTrip.people || 1) - 1) }, (_, i) => ({
          id: `invited-${i}`, name: 'Invited · not joined yet', initials: '—', role: 'participant', joined: false, preferencesSubmitted: false,
        })),
      ]
    : tripMembers
  const submitted = roster.filter(member => member.preferencesSubmitted).length
  const joined = roster.filter(member => member.joined).length
  if (currentUser.role !== 'organizer') {
    return <TripShell><div className="emptyState quietEmptyState"><span></span><h2>Organizer only</h2><p>The member roster is part of maintaining the trip frame. Your own preferences and the shared plan are unaffected.</p><Link className="btn btnSecondary" to={`/trip/${currentTrip.id}/plan`}>Back to plan</Link></div></TripShell>
  }
  return <TripShell>
    <div className="pageHeading editorialPageHeading"><div><span className="eyebrow">Members</span><h1>Who is on this trip</h1><p>You can see whether people replied — never what they asked for. Preference content stays private, including from you.</p></div></div>
    <div className="memberStats">
      <div><strong>{joined}</strong><span>joined</span></div>
      <div><strong>{submitted}</strong><span>preferences in</span></div>
      <div><strong>{roster.length - submitted}</strong><span>still waiting</span></div>
    </div>
    <section className="memberList">
      {roster.map(member => <article className="memberRow" key={member.id}>
        <span className={cx('memberAvatar', !member.joined && 'pendingAvatar')}>{member.initials}</span>
        <div>
          <h3>{member.id === currentUser.id ? `${member.name} (you)` : member.name}</h3>
          <p>{member.role === 'organizer' ? 'Organizer' : 'Participant'}{member.isGuest && ' · guest, no account'}{!member.joined && ' · invite not opened yet'}</p>
        </div>
        <span className={cx('memberState', member.preferencesSubmitted ? 'done' : 'waiting')}>{member.preferencesSubmitted ? 'Preferences in' : member.joined ? 'No preferences yet' : 'Not joined'}</span>
        {!member.preferencesSubmitted && member.joined && <button className="memberRemind" onClick={() => app.notify('Reminder sent')}>Remind</button>}
      </article>)}
    </section>
    <div className="organizerLimits">
      <h3>What you cannot do here</h3>
      <ul>
        <li>Fill in or edit anyone else's preferences</li>
        <li>Treat a non-reply as agreement</li>
        <li>Read private preference text — the same rule applies to you as to everyone</li>
        <li>Confirm a proposal on someone else's behalf</li>
      </ul>
      <div className="btnRow">
        <Button secondary onClick={() => app.notify('Deadline extended by 48 hours')}>Extend deadline</Button>
        <Button ghost onClick={() => app.notify('Reminder sent to everyone still waiting')}>Remind everyone waiting</Button>
      </div>
    </div>
  </TripShell>
}

// 倒计时环:剩余时间占整个窗口的比例
function DeadlineRing({ round, closed }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (closed) return
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [closed])
  const remaining = Math.max(0, round.closesAt - now)
  const fraction = closed ? 0 : Math.max(0, Math.min(1, remaining / round.windowMs))
  const hours = Math.floor(remaining / 3600000)
  const minutes = Math.floor((remaining % 3600000) / 60000)
  const label = closed ? 'Applied' : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
  const radius = 15
  const circumference = 2 * Math.PI * radius
  return <div className={cx('deadlineRing', closed && 'done')}>
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <circle className="ringTrack" cx="18" cy="18" r={radius}/>
      <circle className="ringFill" cx="18" cy="18" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)}/>
    </svg>
    <div><small>{closed ? 'Round' : 'Closes in'}</small><strong>{label}</strong></div>
  </div>
}

// 路径 B 的界面:并行表态的卡片,不是聊天
function DecisionRoundCard({ round, compact }) {
  const app = useTripApp()
  const navigate = useNavigate()
  const myVote = round.votes[currentUser.id] ?? round.votes.self
  const voters = Object.keys(round.votes)
  const voteCount = voters.length
  const closed = round.status === 'closed'
  const winner = closed ? round.options.find(option => option.id === round.winningOptionId) : null
  // 每个候选项拿到多少票 —— 只展示票数,不展示谁投的
  const tally = round.options.reduce((acc, option) => ({ ...acc, [option.id]: Object.values(round.votes).filter(id => id === option.id).length }), {})
  const leading = Math.max(1, ...Object.values(tally))
  return <article className={cx('roundCard', compact && 'roundCardCompact', closed && 'roundClosed')}>
    <div className="roundHead">
      <div>
        <Badge tone={closed ? 'green' : 'blue'}>{closed ? 'Round closed' : 'Group round'}</Badge>
        <h3>{closed ? `Settled: ${winner?.title}` : `This block is contested: ${round.itemTitle}`}</h3>
        <p>{closed
          ? 'Applied to the Current Plan. Members who did not respond are recorded as no preference, never as agreement.'
          : 'Everyone weighs in at once, so this is settled in one round instead of one conversation at a time.'}</p>
      </div>
      <DeadlineRing round={round} closed={closed}/>
    </div>
    <div className="roundTally">
      <div className="voterDots" aria-label={`${voteCount} of ${round.totalMembers} responded`}>
        {Array.from({ length: round.totalMembers }, (_, i) => <i key={i} className={cx(i < voteCount && 'filled')}/>)}
      </div>
      <span>{voteCount} of {round.totalMembers} responded{!closed && ' · silence counts as no preference'}</span>
    </div>
    <div className="roundOptions">
      {round.options.map(option => {
        const count = tally[option.id] || 0
        return <button key={option.id} type="button" className={cx('roundOption', myVote === option.id && 'chosen', closed && round.winningOptionId === option.id && 'won')} disabled={closed} onClick={() => app.castVote(option.id)}>
          <span className="roundOptionTop"><span className="roundOptionLabel">{option.label}</span>{myVote === option.id && <em>Your pick</em>}</span>
          <strong>{option.title}</strong>
          <small>{option.body}</small>
          <span className="voteBar"><i style={{ width: `${(count / leading) * 100}%` }}/></span>
          <span className="voteCount">{count === 0 ? 'No votes yet' : count === 1 ? '1 vote' : `${count} votes`}</span>
        </button>
      })}
    </div>
    {!closed && <div className="roundFooter">
      <span>Anonymous — nobody sees who picked what.</span>
      <button type="button" className="roundDiscuss" onClick={() => navigate(`/trip/${trip.id}/conflict`)}>None of these work — discuss instead</button>
    </div>}
  </article>
}

// 新建的 trip 还没有行程。不伪造计划,而是显示偏好收集进度和下一步动作。
function NewTripPlan({ currentTrip }) {
  const app = useTripApp()
  const total = Math.max(1, currentTrip.people || 1)
  const submitted = app.preferencesSubmittedFor.includes(currentTrip.id) ? 1 : 0
  // 收齐半数(至少 2 份)才允许生成初稿。但阈值不能超过总人数 ——
  // 1~2 人的小团队否则永远达不到。
  const threshold = Math.min(total, Math.max(2, Math.ceil(total / 2)))
  const ready = submitted >= threshold
  return <>
    <div className="pageHeading editorialPageHeading"><div><span className="eyebrow">Current Plan</span><h1>No itinerary yet</h1><p>Waiting for preferences.</p></div></div>
    <div className="planEmptyPanel">
      <section className="collectPanel">
        <div className="collectHead">
          <div><span className="eyebrow">Collecting preferences</span><h3>{submitted} of {total} submitted</h3></div>
          <span className="collectCount">{ready ? 'Ready' : `${threshold - submitted} more to start`}</span>
        </div>
        <div className="collectBar"><i style={{ width: `${Math.min(100, (submitted / total) * 100)}%` }}/><b style={{ left: `${Math.min(100, (threshold / total) * 100)}%` }} title={`Draft can be generated at ${threshold}`}/></div>
        <p className="fieldHint">Draft starts at {threshold} submitted. No reply is recorded as no preference, not agreement.</p>
        {currentTrip.deadline && <div className="collectDeadline"><span>◷</span><div><strong>Preferences deadline</strong><p>{currentTrip.deadline}</p></div></div>}
      </section>
      <div className="proposalCard tripFrameLine"><span>Trip frame</span><h3>{currentTrip.destination} · {currentTrip.dates}</h3><p>{currentTrip.assumptions || 'Share the invite link.'}</p></div>
      <div className="btnRow">
        <Button disabled={!ready} onClick={() => app.notify('Draft generation connects to the backend later')}>Generate draft itinerary</Button>
        <Link className="btn btnSecondary" to={`/trip/${currentTrip.id}/invite`}>Share invite link</Link>
        <Link className="btn btnSecondary" to={`/trip/${currentTrip.id}/preferences`}>{submitted ? 'Edit my preferences' : 'Fill my preferences'}</Link>
      </div>
    </div>
  </>
}

function PlanPage() {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const [openDays, setOpenDays] = useState(['day2'])
  const [comments, setComments] = useState(initialComments)
  const [commenting, setCommenting] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [menuOpen, setMenuOpen] = useState(null)
  const [bookedItems, setBookedItems] = useState(() => new Set(['dinner']))
  const [drawerItem, setDrawerItem] = useState(null)
  const [drawerMode, setDrawerMode] = useState('ask')
  const [selectedTripItemId, setSelectedTripItemId] = useState(null)
  const [railDay, setRailDay] = useState('all')
  useEffect(() => {
    if (!menuOpen) return
    const handle = event => {
      if (!event.target.closest('.moreWrap')) setMenuOpen(null)
    }
    document.addEventListener('pointerdown', handle)
    return () => document.removeEventListener('pointerdown', handle)
  }, [menuOpen])
  // 已生效的改动(路径 A 直接写入 / 路径 B 落地 / 路径 C 确认后)统一以 patch 覆盖
  const patched = item => app.appliedPatches[item.id] ? { ...item, ...app.appliedPatches[item.id], status: 'Updated' } : item
  const days = initialDays.map(day => ({ ...day, items: day.items.map(patched) }))
  const itemDayById = useMemo(() => Object.fromEntries(days.flatMap(day => day.items.map(item => [item.id, day.id]))), [days])
  const handleSelectTripItem = useCallback(itemId => {
    setSelectedTripItemId(itemId)
    const dayId = itemDayById[itemId]
    if (dayId) setOpenDays(current => current.includes(dayId) ? current : [...current, dayId])
    window.setTimeout(() => document.getElementById(`trip-item-${itemId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
  }, [itemDayById])
  const railDays = railDay === 'all' ? days : days.filter(day => day.id === railDay)
  const toggleDay = id => setOpenDays(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  const addComment = id => {
    if (!commentDraft.trim()) return
    setComments(current => ({ ...current, [id]: [...(current[id] || []), { name: currentUser.name.split(' ')[0], text: commentDraft.trim() }] }))
    setCommentDraft('')
    setCommenting(null)
    app.notify('Group note posted')
  }
  const openDrawer = (item, mode, day) => {
    setDrawerItem(day ? { ...item, dayLabel: `${day.label} · ${day.date}` } : item)
    setDrawerMode(mode)
    setMenuOpen(null)
  }
  const markBooked = id => {
    setBookedItems(current => new Set([...current, id]))
    setMenuOpen(null)
    app.notify('Marked as booked')
  }
  if (currentTrip.isCreated) return <TripShell><NewTripPlan currentTrip={currentTrip}/></TripShell>
  return <TripShell>
    <div className={cx('planSplit', !drawerItem && 'withMap', drawerItem && 'withAssistant')}>
      <section className="planMainPane">
        <div className="pageHeading planHeading"><div><span className="eyebrow">Current Plan</span><h1>Your shared itinerary</h1></div><div className="planHeadingActions"><Badge tone="blue">Live plan</Badge><Button secondary className="askTripSyncBtn" onClick={() => openDrawer({ title: 'Full itinerary', place: currentTrip.destination, time: currentTrip.dates, note: 'Ask about the whole trip plan.' }, 'global')}>✦ Ask TripSync</Button></div></div>
        {app.conflictCreated && !app.decisionResolved && <Link className="planNotice" to={`/trip/${currentTrip.id}/updates`}><span>!</span><div><strong>Proposed change waiting for confirmation</strong><p>A hard constraint is involved. The current plan remains active until the affected members accept.</p></div><b>Review →</b></Link>}
        {app.decisionResolved && <div className="successNotice"><span>✓</span><div><strong>The plan was updated</strong><p>Every affected member confirmed. Bookings elsewhere in the plan are unchanged.</p></div></div>}
        <div className="accordionPlan">
          {days.map(day => {
            const open = openDays.includes(day.id)
            return <section className={cx('accordionDay', open && 'open')} key={day.id}>
              <button className="accordionHead" onClick={() => toggleDay(day.id)} aria-expanded={open}>
                <span className="dayNumber">{day.label}</span><div><small>{day.date}</small><h2>{day.title}</h2></div><p>{day.summary}</p><i>{open ? '−' : '+'}</i>
              </button>
              <div className="accordionBody"><div className="accordionInner">
                {/* 每天不再单独放地图 —— 右侧总览已能按天切换,重复且拥挤。
                    这里只留一行路线摘要,保持简约。 */}
                <div className="dayRouteLine">
                  <span>{day.items.length} stops</span>
                  <strong>{day.items.map(item => item.place).join(' → ')}</strong>
                  <button type="button" onClick={() => setRailDay(day.id)}>Show on map</button>
                </div>
                <div className="activityBlocks">{day.items.map((item, index) => <div className="activityBlockGroup" key={item.id}>
                  <article id={`trip-item-${item.id}`} className={cx('activityBlock', selectedTripItemId === item.id && 'selected')} onClick={() => setSelectedTripItemId(item.id)}>
                    <span className="activityIndex"><b>{index + 1}</b></span>
                    <ActivityPhoto item={item}/>
                    <div className="activityMain"><div className="activityTitle"><div><small>{day.date}</small><h3>{item.title}</h3></div>{visibleStatus(bookedItems.has(item.id) ? 'Booked' : item.status) && <Badge tone={statusTone(bookedItems.has(item.id) ? 'Booked' : item.status)}>{visibleStatus(bookedItems.has(item.id) ? 'Booked' : item.status)}</Badge>}</div><p className="activityMeta">⌖ {item.place} <span>•</span> ◷ {item.time}</p><p>{item.note}</p>{item.locked && <small className="lockedNote">🔒 Existing reservation</small>}</div>
                    <div className="activityActions"><button className="itemIconAction" title="Discuss" onClick={() => { setCommenting(commenting === item.id ? null : item.id); setMenuOpen(null) }}>💬{(comments[item.id] || []).length > 0 && <i>{comments[item.id].length}</i>}</button><button className="itemIconAction" title="Ask TripSync" onClick={() => openDrawer(item, 'ask', day)}>✦</button><div className="moreWrap"><button className="moreBtn" onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}>•••</button>{menuOpen === item.id && <div className="actionMenu"><button onClick={() => openDrawer(item, 'editTime', day)}>Edit time</button><button onClick={() => openDrawer(item, 'moveDay', day)}>Move to another day</button><button onClick={() => openDrawer(item, 'replacePlace', day)}>Replace place</button><button onClick={() => markBooked(item.id)}>{bookedItems.has(item.id) ? 'Booked' : 'Mark as booked'}</button><button onClick={() => openDrawer(item, 'removePlan', day)}>Remove from plan</button><button onClick={() => openDrawer(item, 'details', day)}>View details</button></div>}</div></div>
                    {(comments[item.id] || []).length > 0 && <div className="publicThread">{comments[item.id].map((comment, i) => <div key={`${item.id}-${i}`}><span>{comment.name.slice(0,2).toUpperCase()}</span><p><strong>{comment.name}</strong>{comment.text}</p></div>)}</div>}
                    {commenting === item.id && <div className="publicComposer"><label>Group note</label><textarea rows="2" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Everyone in this trip can see this note."/><div><button onClick={() => { setCommenting(null); setCommentDraft('') }}>Cancel</button><Button onClick={() => addComment(item.id)}>Post note</Button></div></div>}
                  </article>
                  {app.activeRound?.itemId === item.id && <DecisionRoundCard round={app.activeRound} compact/>}
                  {index < day.items.length - 1 && <div className="routeSegment"><strong>{routeSegments[index % routeSegments.length]}</strong><button type="button">Route</button></div>}
                </div>)}</div>
              </div></div>
            </section>
          })}
        </div>
      </section>
      {!drawerItem && <aside className="tripMapRail" aria-label="Trip route overview">
        <div className="tripMapCard">
          <div className="mapDayTabs">
            <button type="button" className={railDay === 'all' ? 'active' : ''} onClick={() => setRailDay('all')}>All</button>
            {days.map(day => <button type="button" key={day.id} className={railDay === day.id ? 'active' : ''} onClick={() => setRailDay(day.id)}>{day.label.split(' · ')[0]}</button>)}
          </div>
          <TripMap key={railDay} days={railDays} destination={currentTrip.destination} selectedItemId={selectedTripItemId} onSelectItem={handleSelectTripItem} variant="real" markerMode={railDay === 'all' ? 'day' : 'stop'}/>
          <div className="tripMapSummary">
            <strong>{railDay === 'all' ? `${days.reduce((n, d) => n + d.items.length, 0)} stops across ${days.length} days` : `${railDays[0]?.items.length || 0} stops · ${railDays[0]?.date || ''}`}</strong>
            <p>Tap a pin to jump to that stop.</p>
          </div>
        </div>
      </aside>}
      {drawerItem && <AssistantDrawer item={drawerItem} mode={drawerMode} onClose={() => setDrawerItem(null)} inline/>}
    </div>
  </TripShell>
}

function AssistantDrawer({ item, mode, onClose, inline = false }) {
  const app = useTripApp()
  const navigate = useNavigate()
  const [verdict, setVerdict] = useState(null)
  const [done, setDone] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const actionLabels = {
    global: 'Ask TripSync',
    ask: 'Ask TripSync',
    editTime: 'Edit time',
    moveDay: 'Move to another day',
    replacePlace: 'Replace place',
    removePlan: 'Remove from plan',
    details: 'View details',
  }
  const needsCheck = ['editTime', 'moveDay', 'replacePlace', 'removePlan'].includes(mode)
  const placeholder = {
    global: 'Ask about the whole plan...',
    ask: 'Ask about this activity...',
    editTime: 'Example: move this to 3:30 PM',
    moveDay: 'Example: move this to Day 3 afternoon',
    replacePlace: 'Example: replace with something near dinner and less walking',
    removePlan: 'Optional: why remove this?',
    details: '',
  }[mode]
  const runCheck = () => {
    const request = draft.trim() || placeholder
    const classification = app.classify({ item, actionType: mode, request })
    setVerdict({ ...classification, request })
    setMessages(current => [...current,
      { from: 'you', text: request },
      { from: 'tripSync', text: `${classification.headline}. ${classification.detail}` },
    ])
    setDraft('')
  }
  const commit = () => {
    if (!verdict || done) return
    if (verdict.path === 'A') {
      app.applyDirectChange({ item, actionType: mode, request: verdict.request })
      app.notify('Applied — the group just gets a notice')
    } else if (verdict.path === 'B') {
      app.openDecisionRound({ item, request: verdict.request })
      app.notify('Group round opened')
    } else {
      app.createChangeProposal({ item, actionType: mode, request: verdict.request, classification: verdict })
      app.notify('Sent for confirmation')
    }
    setDone(true)
    if (verdict.path === 'C') navigate(`/trip/${trip.id}/conflict`)
    else navigate(`/trip/${trip.id}/updates`)
  }
  const sendMessage = () => {
    if (needsCheck && !verdict) return runCheck()
    if (!draft.trim()) return
    setMessages(current => [...current, { from: 'you', text: draft.trim() }, { from: 'tripSync', text: 'I checked this against the itinerary context. Ask me to compare options or draft a change if you want to adjust it.' }])
    setDraft('')
  }
  const commitLabel = { A: 'Apply now', B: 'Open the round', C: 'Send for confirmation' }
  const drawer = <aside className={cx('assistantDrawer', inline && 'inlineAssistant')} onClick={event => event.stopPropagation()}>
      <header><div><span className="eyebrow">{actionLabels[mode]}</span><h2>{item.title}</h2><p>{item.place} · {item.time}</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="drawerThread">
        <div className="assistantBubbleRail"><i/><i/><i/></div>
        <ChatBubble from="tripSync">{mode === 'details' ? 'Here are the details for this itinerary item.' : needsCheck ? 'Tell me the change you want. I check hard constraints first, then whether anyone else already asked about this slot.' : 'Ask about timing, location, tradeoffs, or why this item is in the plan.'}</ChatBubble>
        {messages.map((message, index) => <ChatBubble from={message.from} key={`${message.from}-${index}`}>{message.text}</ChatBubble>)}
        {mode === 'details' && <div className="detailSheet"><dl><div><dt>Time</dt><dd>{item.time}</dd></div><div><dt>Place</dt><dd>{item.place}</dd></div><div><dt>Status</dt><dd>{item.status || '—'}</dd></div><div><dt>Note</dt><dd>{item.note}</dd></div></dl></div>}
        {verdict && <div className={`impactResult pathResult path${verdict.path}`}>
          <span>{pathLabels[verdict.path]}</span>
          <h3>{verdict.headline}</h3>
          <p>{verdict.detail}</p>
          <ul className="verdictChecks">
            {verdict.checks?.map(check => <li key={check.id} className={cx(check.hit && 'hit')}>
              <span>{check.hit ? '✕' : '✓'}</span>
              <div><strong>{check.label}</strong>{check.hit && check.privateNote && <small>{check.privateNote}</small>}</div>
              <em>{check.hit ? 'hit' : 'clear'}</em>
            </li>)}
          </ul>
          <div className="pathLadder">
            {['A', 'B', 'C'].map(step => <i key={step} className={cx(verdict.path === step && 'on')}>{step === 'A' ? 'Notice' : step === 'B' ? 'Round' : 'Confirm'}</i>)}
          </div>
          <div className="miniAlternatives">
            <button onClick={commit} disabled={done}>{done ? 'Done' : commitLabel[verdict.path]}</button>
            <button onClick={onClose}>Cancel</button>
          </div>
        </div>}
        {!verdict && needsCheck && <div className="proposalCard"><span>Before changing</span><h3>Current Plan stays unchanged</h3><p>TripSync checks hard constraints first, then whether this slot is already contested.</p></div>}
      </div>
      {mode !== 'details' && !verdict && <div className="drawerComposer"><input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendMessage()} placeholder={placeholder}/><button onClick={sendMessage}>{needsCheck ? 'Check impact' : 'Send'}</button></div>}
    </aside>
  if (inline) return drawer
  return <div className="drawerOverlay" onClick={onClose}>{drawer}</div>
}

function ChatBubble({ from, children }) {
  const isUser = from === 'you'
  return <div className={cx('chatBubbleRow', isUser && 'mine')}>
    {!isUser && <span className="chatAvatar tripSync">T</span>}
    <div className={cx('drawerMessage', isUser ? 'mine' : 'assistant')}><strong>{isUser ? 'You' : 'TripSync'}</strong><p>{children}</p></div>
    {isUser && <span className="chatAvatar user">{currentUser.initials}</span>}
  </div>
}

function ChatWorkspace({ thread }) {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const isDemoTrip = currentTrip.id === trip.id
  const showTradeoff = isDemoTrip && app.conflictCreated
  return <TripShell>
    <div className="chatLayout">
      <aside className="conversationList">
        <div className="conversationHead"><span className="eyebrow">Conversations</span><h2>Chat</h2></div>
        <Link className={cx('conversation', thread === 'personal' && 'active')} to={`/trip/${currentTrip.id}/chat`}><span className="aiAvatar">T</span><div><strong>TripSync</strong><small>Private planning assistant</small></div></Link>
        {showTradeoff && <Link className={cx('conversation', thread === 'tradeoff' && 'active')} to={`/trip/${currentTrip.id}/conflict`}><span className="pairAvatar anon">◍</span><div><strong>Constraint tradeoff</strong><small>Anonymous · affected members only</small></div></Link>}
      </aside>
      {thread === 'tradeoff' && showTradeoff ? <TradeoffThread/> : thread === 'tradeoff' ? <EmptyTradeoffPanel tripId={currentTrip.id}/> : <PersonalThread/>}
    </div>
  </TripShell>
}

function EmptyTradeoffPanel({ tripId }) {
  return <section className="chatPanel">
    <header><div><span className="pairAvatar anon">◍</span><div><h2>Constraint tradeoff</h2><p>No active conversation</p></div></div></header>
    <div className="messages">
      <div className="emptyState quietEmptyState"><span></span><h2>Nothing to resolve</h2><p>Most changes never reach a conversation. One opens here only when a change touches a hard constraint that cannot be settled by choosing an option.</p><Link className="btn btnSecondary" to={`/trip/${tripId}/plan`}>Back to plan</Link></div>
    </div>
  </section>
}

function PersonalThread() {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const send = () => {
    if (!draft.trim()) return
    setMessages(current => [...current, { from: 'you', text: draft.trim() }, { from: 'tripSync', text: 'I can check that against the current plan — hard constraints first, then whether anyone else has asked about the same slot. Most requests apply straight away; only the hard ones need other people.' }])
    setDraft('')
  }
  return <section className="chatPanel">
    <header><div><span className="aiAvatar">T</span><div><h2>TripSync</h2><p>Private · not shared with the group</p></div></div><Badge>My AI</Badge></header>
    <div className="messages">
      <ChatBubble from="tripSync">This conversation is just between us. Ask about the plan, flag fatigue or weather, or request a change — nothing reaches the group until I have checked what it affects.</ChatBubble>
      {messages.map((message, index) => <ChatBubble from={message.from} key={`${message.from}-${index}`}>{message.text}</ChatBubble>)}
    </div>
    <div className="chatComposer"><button>＋</button><input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && send()} placeholder="Message TripSync privately..."/><button className="sendBtn" onClick={send}>↑</button></div>
  </section>
}

// 路径 C:只有受影响成员 + AI。除了当前用户,所有人匿名。
function TradeoffThread() {
  const app = useTripApp()
  const [reply, setReply] = useState('')
  const [threadMessages, setThreadMessages] = useState([])
  const proposal = app.activeProposal
  useEffect(() => {
    if (app.decisionResolved) return
    const timer = window.setTimeout(() => {
      app.resolveProposal()
      app.notify('The other affected member accepted — plan updated')
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [app.decisionResolved])
  if (!proposal) return null
  const { before, after, affectedMembers } = proposal
  const sendReply = () => {
    if (!reply.trim()) return
    setThreadMessages(current => [...current,
      { from: 'you', text: reply.trim() },
      { from: 'tripSync', text: 'Noted. The Current Plan stays unchanged until every affected member confirms.' },
    ])
    setReply('')
  }
  return <section className="chatPanel">
    <header><div><span className="pairAvatar anon">◍</span><div><h2>Constraint tradeoff</h2><p>{affectedMembers.length} affected members · anonymous</p></div></div><Badge tone={app.decisionResolved ? 'green' : 'orange'}>{app.decisionResolved ? 'Resolved' : 'Awaiting confirmation'}</Badge></header>
    <div className="messages conflictMessages">
      <div className="anonBanner"><span>◍</span><p>{proposal.privacyNote}</p></div>
      <div className="message ai"><span>✦</span><div><p>{proposal.headline}. {proposal.detail}</p><p>This could not be settled by picking an option, so it comes to the affected members directly. The person who proposed it counts as accepted.</p></div></div>
      <div className="changeCompare conflictCompare"><div><small>Current{before.dayLabel ? ` · ${before.dayLabel}` : ''}</small><strong>{before.time} · {before.title}</strong><span>{before.place}</span></div><b>→</b><div className="new"><small>Proposed{after.dayLabel ? ` · ${after.dayLabel}` : ''}</small><strong>{after.time} · {after.title}</strong><span>{after.place}</span></div></div>
      <div className="impactRow conflictImpactRow">{affectedMembers.map(member => <span key={member.id}>{member.label}: {app.decisionResolved || member.status === 'accepted' ? 'accepted' : 'needs decision'}{member.proposer ? ' (proposer)' : ''}</span>)}<span>Names hidden</span><span>Private reasons hidden</span></div>
      <div className="message other"><span className="avatar small anon">◍</span><div><p>This works for me as long as the confirmed booking stays untouched.</p><small>{proposal.affectedMembers[1]?.label} · 10:47 AM</small></div></div>
      {!app.decisionResolved && <div className="message ai"><span>✦</span><div><p>The booking stays as it is and one private constraint is protected. Waiting on the remaining affected member — the Current Plan does not move until then.</p><div className="messageActions"><Button secondary onClick={() => app.notify('Alternative requested')}>Suggest another option</Button><Button ghost onClick={() => { app.withdrawProposal(); app.notify('Withdrawn — current plan kept') }}>Withdraw</Button></div></div></div>}
      {threadMessages.map((message, index) => <ChatBubble from={message.from} key={`${message.from}-${index}`}>{message.text}</ChatBubble>)}
      {app.decisionResolved && <div className="message ai resolvedMessage"><span>✓</span><div><p>Every affected member confirmed. The Current Plan is updated and the booking is unchanged.</p><Link className="inlineAction" to={`/trip/${trip.id}/plan`}>View updated plan →</Link></div></div>}
    </div>
    <div className="chatComposer"><button>＋</button><input value={reply} onChange={event => setReply(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendReply()} placeholder="Reply anonymously in this conversation..."/><button className="sendBtn" onClick={sendReply}>↑</button></div>
  </section>
}

function UpdatesPage() {
  const app = useTripApp()
  const navigate = useNavigate()
  const currentTrip = useCurrentTrip()
  const isDemoTrip = currentTrip.id === trip.id
  const round = isDemoTrip ? app.activeRound : null
  const roundOpen = round?.status === 'open'
  const proposalPending = isDemoTrip && app.conflictCreated && !app.decisionResolved
  const proposal = app.activeProposal
  const hasActions = roundOpen || proposalPending
  return <TripShell>
    <div className="pageHeading editorialPageHeading"><div><span className="eyebrow">Updates</span><h1>Trip notes</h1><p>Most changes land here as a notice. Only contested or constrained ones ask you for something.</p></div></div>
    <div className="updateFilters editorialUpdateTabs">
      <button className={app.updateFilter === 'all' ? 'active' : ''} onClick={() => app.setUpdateFilter('all')}>All</button>
      <button className={app.updateFilter === 'forYou' ? 'active' : ''} onClick={() => app.setUpdateFilter('forYou')}>For you</button>
      <button className={app.updateFilter === 'actions' ? 'active' : ''} onClick={() => app.setUpdateFilter('actions')}>Actions {hasActions && <i>{(roundOpen ? 1 : 0) + (proposalPending ? 1 : 0)}</i>}</button>
    </div>
    <section className="updatesList">
      {app.updateFilter === 'actions' && <>
        {!hasActions && <div className="emptyState quietEmptyState"><span></span><h2>No actions right now</h2><p>If a block becomes contested, or a change touches a hard constraint, it will appear here.</p></div>}
        {roundOpen && <DecisionRoundCard round={round}/>}
        {proposalPending && <article className="decisionCard">
          <div className="decisionTop"><div><Badge tone="orange">Needs confirmation</Badge><h2>{proposal.headline}</h2><p>{proposal.detail} You proposed this, so you already count as accepted.</p></div><span>{proposal.createdAt}</span></div>
          <div className="changeCompare"><div><small>Current{proposal.before.dayLabel ? ` · ${proposal.before.dayLabel}` : ''}</small><strong>{proposal.before.time} · {proposal.before.title}</strong><span>{proposal.before.place}</span></div><b>→</b><div className="new"><small>Proposed{proposal.after.dayLabel ? ` · ${proposal.after.dayLabel}` : ''}</small><strong>{proposal.after.time} · {proposal.after.title}</strong><span>{proposal.after.place}</span></div></div>
          <div className="impactRow">{proposal.affectedMembers.map(member => <span key={member.id}>{member.label}: {member.status === 'accepted' ? 'accepted' : 'needs decision'}</span>)}<span>Names hidden</span></div>
          <div className="decisionActions"><Button onClick={() => navigate(`/trip/${currentTrip.id}/conflict`)}>Open the conversation</Button><Button ghost onClick={() => { app.withdrawProposal(); app.notify('Withdrawn — current plan kept') }}>Withdraw</Button></div>
        </article>}
      </>}
      {app.updateFilter === 'all' && <>
        {isDemoTrip ? [...app.notices, ...baseUpdates].map(item => <article className="updateRow" key={item.id}><span className={`updateIcon ${item.kind}`}>{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p>{item.canObject && <button className="objectLink" onClick={() => { app.objectToNotice(item); app.setUpdateFilter('actions'); app.notify('Escalated to a group round') }}>I have a different idea →</button>}</div><time>{item.time}</time></article>)
          : <div className="emptyState quietEmptyState"><span></span><h2>No updates yet</h2><p>Activity for this trip will appear here once members join and preferences arrive.</p></div>}
      </>}
      {app.updateFilter === 'forYou' && <>
        {isDemoTrip ? <>
          {personalUpdates.map(item => <article className="updateRow" key={item.id}><span className={`updateIcon ${item.kind}`}>{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p></div><time>{item.time}</time></article>)}
        </> : <div className="emptyState quietEmptyState"><span></span><h2>Nothing for you yet</h2><p>Mentions and replies that involve you will appear here.</p></div>}
      </>}
    </section>
  </TripShell>
}

function PreferencesPage() {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const [form, setForm] = useState(app.preferences)
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const toggleStyle = style => setForm(current => {
    const selected = current.interests || []
    if (selected.includes(style)) return { ...current, interests: selected.filter(item => item !== style) }
    if (selected.length >= 3) return { ...current, interests: [...selected.slice(1), style] }
    return { ...current, interests: [...selected, style] }
  })
  const setNeed = (id, key, value) => setForm(current => ({ ...current, essentialNeeds: current.essentialNeeds.map(need => need.id === id ? { ...need, [key]: value } : need) }))
  const addNeed = () => setForm(current => ({ ...current, essentialNeeds: [...current.essentialNeeds, { id: `need-${Date.now()}`, text: '', importance: 'flexible', visibility: 'planning' }] }))
  const removeNeed = id => setForm(current => ({ ...current, essentialNeeds: current.essentialNeeds.filter(need => need.id !== id) }))
  const save = () => {
    app.setPreferences({ ...form, essentialNeeds: form.essentialNeeds.filter(need => need.text.trim()) })
    app.submitPreferencesFor(currentTrip.id)
    app.notify('Preferences saved · shared anonymously')
  }
  return <TripShell>
    <div className="preferenceWrap editorialForm">
      <div className="pageHeading"><div><span className="eyebrow">My preferences</span><h1>Share only what matters.</h1><p>Ideal versus acceptable are separate on purpose: TripSync optimizes toward your ideal, and never crosses your confirmed limits.</p></div></div>
      <section className="preferenceCard preferenceFlow">
        <div className="wide dateField"><label>Preferred dates — the trip you would ideally join</label><DateRangePicker value={form.preferredRange} onChange={range => set('preferredRange', range)}/></div>
        <details className="wide optionalPanel"><summary>Available date range — the widest window that still works for you</summary><div className="dateField" style={{ marginTop: 12 }}><DateRangePicker value={form.availableRange} onChange={range => set('availableRange', range)}/></div></details>
        <div className="wide fieldPair">
          <label>Ideal total budget<input value={form.idealBudget} onChange={e => set('idealBudget', e.target.value)}/></label>
          <label>Maximum acceptable budget<input value={form.maxBudget} onChange={e => set('maxBudget', e.target.value)}/></label>
        </div>
        <CustomSelect className="wide" label="Who can see my budget" value={form.budgetVisibility} onChange={value => set('budgetVisibility', value)} options={[{ value: 'planning', label: 'Planning system only' }, { value: 'organizer', label: 'Planning system + organizer' }, { value: 'everyone', label: 'Everyone in this trip' }]}/>
        <CustomSelect className="wide" label="Preferred pace" value={form.pace} onChange={value => set('pace', value)} options={['Relaxed', 'Balanced', 'Full schedule'].map(option => ({ value: option, label: option }))}/>
        <div className="wide"><label>Top interests — up to 3</label><div className="styleGrid">{tripStyles.map(style => <button type="button" key={style} className={cx('styleTile', form.interests?.includes(style) && 'selected')} onClick={() => toggleStyle(style)}><span>{style}</span><small>{style === 'Food' ? 'better meals' : style === 'Nature' ? 'parks and views' : style === 'Relaxed' ? 'slower days' : style === 'Culture' ? 'museums and neighborhoods' : 'more active plans'}</small></button>)}</div></div>
        <div className="wide needsPanel">
          <label>Essential needs</label>
          {form.essentialNeeds.map(need => <div className="needRow" key={need.id}>
            <input value={need.text} placeholder="e.g. No activities before 9:00 AM" onChange={e => setNeed(need.id, 'text', e.target.value)}/>
            <CustomSelect value={need.importance} onChange={value => setNeed(need.id, 'importance', value)} options={[{ value: 'required', label: 'Required' }, { value: 'flexible', label: 'Flexible' }]}/>
            <CustomSelect value={need.visibility} onChange={value => setNeed(need.id, 'visibility', value)} options={[{ value: 'planning', label: 'Private' }, { value: 'organizer', label: 'Organizer' }, { value: 'everyone', label: 'Everyone' }]}/>
            <button type="button" className="needRemove" aria-label="Remove need" onClick={() => removeNeed(need.id)}>×</button>
          </div>)}
          <button type="button" className="needAdd" onClick={addNeed}>＋ Add essential need</button>
        </div>
        <details className="wide optionalPanel"><summary>Anything to avoid</summary><label>Prefer to avoid<textarea rows="3" value={form.avoid} onChange={e => set('avoid', e.target.value)}/></label></details>
        <div className="privacyBox wide"><div><strong>Anonymous by default</strong><p>Private needs never show your name or raw text. Others only see anonymous impact, like “one requirement affects this activity.”</p></div><Badge tone="green">Protected</Badge></div>
        <div className="formFooter"><span>Preference updates are never announced to the group with your name.</span><Button onClick={save}>Save preferences</Button></div>
      </section>
    </div>
  </TripShell>
}

function CreateTrip() {
  const navigate = useNavigate()
  const app = useTripApp()
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  const [form, setForm] = useState({ name: '', destination: '', theme: '', groupSize: '', currency: 'USD', budget: '', assumptions: '', deadline: '' })
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const canCreate = form.name.trim() && form.destination.trim() && dateRange.start && dateRange.end
  const createTrip = () => {
    const created = app.addTrip({
      name: form.name.trim(),
      destination: form.destination.trim(),
      theme: form.theme.trim(),
      dates: formatDateRange(dateRange),
      people: Number(form.groupSize) || 1,
      currency: form.currency,
      budget: form.budget.trim(),
      assumptions: form.assumptions.trim(),
      deadline: form.deadline.trim(),
    })
    app.setInviteCopied(false)
    app.notify('Trip created')
    navigate(`/trip/${created.id}/invite`)
  }
  return <div className="simplePage createPage"><header className="editorialNav glassTop"><Logo/><nav><Link to="/">MY TRIPS</Link><Link className="active" to="/create">NEW TRIP</Link></nav><div className="editorialActions"><ActionBell/><ProfileMenu/></div></header><main className="createEditorial">
    <section className="createHero"><div><span className="roleChip">Organizer</span><h1>Create the trip frame.</h1><p>Set the destination, date window, group size, and shared assumptions. Guests add their preferences after joining.</p></div><div className="createHeroPhoto"><Badge tone="blue">New trip</Badge></div></section>
    <section className="preferenceCard createGrid createFlow">
      <div className="formChapter wide"><span>01</span><h2>Where and why</h2></div>
      <label>Trip name<input value={form.name} placeholder="e.g. Mia's 30th in Chicago" onChange={e => set('name', e.target.value)}/></label><label>Destination<input value={form.destination} placeholder="e.g. Chicago, Illinois" onChange={e => set('destination', e.target.value)}/></label>
      <label>Trip theme<input value={form.theme} placeholder="e.g. Birthday weekend" onChange={e => set('theme', e.target.value)}/></label><label>Expected group size<input type="number" min="1" value={form.groupSize} placeholder="6" onChange={e => set('groupSize', e.target.value)}/></label>
      <div className="formChapter wide"><span>02</span><h2>Date window</h2></div>
      <div className="wide dateField"><DateRangePicker value={dateRange} onChange={setDateRange}/></div>
      <div className="formChapter wide"><span>03</span><h2>Budget and assumptions</h2></div>
      <label>Currency<select value={form.currency} onChange={e => set('currency', e.target.value)}><option>USD</option><option>CAD</option><option>CNY</option><option>EUR</option></select></label><label>Approximate budget<input value={form.budget} placeholder="e.g. $600 per person" onChange={e => set('budget', e.target.value)}/></label>
      <label className="wide">Shared trip assumptions<textarea rows="4" value={form.assumptions} placeholder="e.g. Relaxed pace, central stay, shared dinners." onChange={e => set('assumptions', e.target.value)}/></label>
      <label className="wide">Preferences deadline<input value={form.deadline} placeholder="e.g. Friday, August 7 at 6:00 PM" onChange={e => set('deadline', e.target.value)}/></label>
      <div className="formFooter wide"><span>Guests will choose dates and styles from this frame.</span><Button disabled={!canCreate} onClick={createTrip}>Create trip</Button></div>
    </section>
  </main></div>
}

function InvitePage() {
  const app = useTripApp()
  const navigate = useNavigate()
  const currentTrip = useCurrentTrip()
  const inviteUrl = `${window.location.origin}${window.location.pathname}#/join/${currentTrip.id}`
  const copyLink = () => {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(inviteUrl).catch(() => {})
    app.setInviteCopied(true)
    app.notify('Invite link copied')
  }
  return <TripShell>
    <div className="inviteManager">
      <section className="shareHero">
        <span className="eyebrow">Invite link</span>
        <h1>Share this trip with the group.</h1>
        <p>Guests open this link, join the trip, and submit preferences. Their answers default to anonymous summary.</p>
      </section>
      <section className="linkPanel">
        <div><span className="roleChip">{app.inviteCopied ? 'Link copied' : 'Ready to share'}</span><h2>{currentTrip.name}</h2><p>{currentTrip.destination} · {currentTrip.dates}</p></div>
        <label>Invite link<input readOnly value={inviteUrl}/></label>
        <div className="copyActions"><Button onClick={copyLink}>{app.inviteCopied ? 'Copied' : 'Copy link'}</Button><Button secondary onClick={() => navigate(`/trip/${currentTrip.id}/plan`)}>Start planning</Button></div>
        {app.inviteCopied && <div className="copiedState"><strong>Link ready to share</strong><p>Guests will join from this link and their preferences will feed into this trip.</p></div>}
        <div className="privacyBox"><div><strong>Privacy default</strong><p>Guests can choose whether raw answers are visible. Organizer sees anonymous summaries by default.</p></div><Badge tone="green">Anonymous</Badge></div>
      </section>
    </div>
  </TripShell>
}

function JoinInvitePage() {
  const app = useTripApp()
  const navigate = useNavigate()
  const currentTrip = useCurrentTrip()
  return <div className="invitePage">
    <header className="inviteGlass"><Logo/><div><span className="roleChip">Guest invite</span><strong>{currentTrip.name}</strong></div></header>
    <main className="inviteLayout">
      <section className="invitePhoto"><div><Badge tone="blue">{currentTrip.dates}</Badge><h1>{currentTrip.destination} with the group.</h1><p>Join the trip, share your dates, and set a few preferences before the plan changes around you.</p></div></section>
      <section className="invitePanel">
        <span className="eyebrow">Join TripSync</span><h2>You have been invited</h2><p>The organizer receives an anonymous summary unless you allow raw answers.</p>
        <label>Your name<input defaultValue={guestDraft.name}/></label><label>Email<input defaultValue={guestDraft.email}/></label>
        <div className="privacyBox"><div><strong>Anonymous summary</strong><p>Your sensitive preferences stay grouped by default.</p></div><Badge tone="green">Default</Badge></div>
        <Button onClick={() => { app.notify('Joined trip'); navigate(`/trip/${currentTrip.id}/preferences`) }}>Join and set preferences</Button>
      </section>
    </main>
  </div>
}

export default function FinalApp() {
  return <TripAppProvider><Routes>
    <Route path="*" element={<Navigate to="/" replace/>}/>
    <Route path="/" element={<Home/>}/>
    <Route path="/create" element={<CreateTrip/>}/>
    <Route path="/trip/:tripId/plan" element={<PlanPage/>}/>
    <Route path="/trip/:tripId/chat" element={<ChatWorkspace thread="personal"/>}/>
    <Route path="/trip/:tripId/conflict" element={<ChatWorkspace thread="tradeoff"/>}/>
    <Route path="/trip/:tripId/updates" element={<UpdatesPage/>}/>
    <Route path="/trip/:tripId/preferences" element={<PreferencesPage/>}/>
    <Route path="/trip/:tripId/members" element={<MembersPage/>}/>
    <Route path="/trip/:tripId/invite" element={<InvitePage/>}/>
    <Route path="/join/:tripId" element={<JoinInvitePage/>}/>
  </Routes><ScrollToTop/></TripAppProvider>
}
