import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { TripAppProvider, useTripApp } from './TripAppState.jsx'
import { otherTrips, trip, tripMembers, tripStyles } from './tripContent.js'
import TripMap from './TripMap.jsx'
import { serializeWorkspaceRoute } from '../../../shared/trip-navigation-route/index.js'
import { buildTripPreviewAbsoluteUrl } from '../../../shared/tripsync-preview-contract.js'
import {
  buildWorkspaceNavigationModel,
  resolveCurrentWorkspaceRoute,
  resolveInviteJoinRoute,
  resolveRestoredWorkspaceDestination,
} from './workspace-navigation-model.js'

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
const formatInviteDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
// 改动卡上的日期。写成 "Sat, Aug 15" —— 换天的改动只看时间是分不清的。
// 日期选择器给的是 Date 对象，后端要 YYYY-MM-DD
const toISODate = value => {
  if (!value) return null
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fromISODate = value => value ? new Date(`${value}T00:00:00`) : null

const formatChangeDay = value => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  : null

const formatPlanHour = value => {
  if (value === null || value === undefined || value === '') return '—'
  const numeric = Number(value)
  const whole = Math.floor(numeric)
  const minutes = Math.round((numeric - whole) * 60)
  const suffix = whole >= 12 ? 'PM' : 'AM'
  return `${whole % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

const coordsFor = item => {
  if (!Array.isArray(item?.coords) || item.coords.length < 2) return null
  const [lat, lng] = item.coords.map(Number)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

const straightLineMiles = (from, to) => {
  const start = coordsFor(from)
  const end = coordsFor(to)
  if (!start || !end) return null
  const radiusMiles = 3958.8
  const toRad = degrees => degrees * Math.PI / 180
  const dLat = toRad(end.lat - start.lat)
  const dLng = toRad(end.lng - start.lng)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(start.lat)) * Math.cos(toRad(end.lat)) *
    Math.sin(dLng / 2) ** 2
  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const formatStraightLineDistance = (from, to) => {
  const miles = straightLineMiles(from, to)
  if (miles === null) return 'Distance unavailable'
  if (miles < 0.1) return '<0.1 mi straight line'
  return `${miles.toFixed(miles < 10 ? 1 : 0)} mi straight line`
}

const pathLabels = {
  notice: 'Applies now',
  round: 'Group round',
  reopen_round: 'Reopening a settled block',
  confirm: 'Needs confirmation',
}
const commitLabel = {
  notice: 'Apply now',
  round: 'Open the round',
  reopen_round: 'Open the round',
  confirm: 'Send for confirmation',
}
const pathClass = {
  notice: 'pathA',
  round: 'pathB',
  reopen_round: 'pathB',
  confirm: 'pathC',
}
const tripNavigationLabels = {
  plan: 'Plan',
  chat: 'Chat',
  updates: 'Updates',
  preferences: 'Preferences',
  members: 'Members',
  invite: 'Invite',
}
const accountNavigationLabels = {
  'account-profile': 'Profile',
  'account-travel': 'Travel profile',
  'account-notifications': 'Notifications',
  'account-settings': 'Settings',
}
const workspaceHomeHref = () => serializeWorkspaceRoute({ kind: 'home' })
const workspaceCreateHref = () => serializeWorkspaceRoute({ kind: 'create-trip' })
const accountHref = section => serializeWorkspaceRoute({ kind: 'account', section })
const tripHref = (tripId, section) => serializeWorkspaceRoute({ kind: 'trip', tripId, section })
const joinHref = token => serializeWorkspaceRoute({ kind: 'join', token })
const tripPlanHref = (tripId, focusItemId) => {
  const href = tripHref(tripId, 'plan')
  return focusItemId ? `${href}?focus=${encodeURIComponent(focusItemId)}` : href
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
  return app.trips.find(item => item.id === tripId) || app.trip || trip
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

function Logo() {
  return <Link to="/" className="logo"><span className="logoMark">C</span><span>Cadensy</span></Link>
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
  const currentTrip = app.trip || trip
  const updatesHref = tripHref(currentTrip.id, 'updates')
  const actions = []
  app.activeRounds?.filter(round => round.status === 'open').forEach(round => actions.push({ trip: currentTrip.name, text: `${round.itemTitle || 'A block'} has a group round open`, to: updatesHref }))
  app.activeProposals?.filter(proposal => ['waiting_affected_members', 'escalated'].includes(proposal.status)).forEach(proposal => actions.push({ trip: currentTrip.name, text: proposal.status === 'escalated' ? `${proposal.before?.title || 'A proposal'} is with the organizer` : `${proposal.before?.title || 'A proposal'} is waiting for confirmation`, to: updatesHref }))
  return <div className="actionBellWrap" ref={ref}>
    <button className={cx('actionBell', actions.length && 'hasActions')} type="button" onClick={() => setOpen(current => !current)} aria-label="Action inbox">🔔</button>
    {open && <div className="actionInbox">
      <div className="actionInboxHead"><span>Actions</span><small>{actions.length ? `${actions.length} waiting` : 'Clear'}</small></div>
      {actions.length === 0 && <div className="actionInboxEmpty">No trip actions right now.</div>}
      {actions.map(action => <Link key={action.text} to={action.to} className="actionInboxItem">
        <strong>{action.trip}</strong>
        <span>{action.text}</span>
      </Link>)}
      {actions.length > 0 && <Link className="actionInboxFooter" to={updatesHref}>Open trip actions →</Link>}
    </div>}
  </div>
}

function ProfileMenu() {
  const app = useTripApp()
  const currentUser = app.currentUser
  const [open, setOpen] = useState(false)
  const ref = useClickOutside(open, () => setOpen(false))
  const menuLinks = [
    { to: accountHref('profile'), icon: '◌', label: 'Profile', detail: 'Name, email, account' },
    { to: accountHref('travel'), icon: '✈', label: 'Travel profile', detail: 'Defaults for new trips' },
    { to: accountHref('notifications'), icon: '◍', label: 'Notifications', detail: 'Trip alerts and reminders' },
    { to: accountHref('settings'), icon: '⚙', label: 'Settings', detail: 'Privacy and appearance' },
  ]
  return <div className="profileMenuWrap" ref={ref}>
    <button className="profileButton" type="button" onClick={() => setOpen(current => !current)} aria-label="Profile menu">{currentUser.initials}</button>
    {open && <div className="profileMenu">
      <div className="profileMenuHead"><span className="profilePhoto">{currentUser.initials}</span><div><strong>{currentUser.name}</strong><small>{currentUser.email || (currentUser.isGuest ? 'Guest' : 'No email')}</small></div></div>
      <div className="profileMenuSection">
        {menuLinks.map(link => <Link key={link.to} to={link.to} className="profileMenuItem" onClick={() => setOpen(false)}>
          <span>{link.icon}</span><div><strong>{link.label}</strong><small>{link.detail}</small></div>
        </Link>)}
      </div>
      <button type="button" className="profileMenuSignOut" onClick={() => { setOpen(false); app.logout() }}><span>↪</span><div><strong>Sign out</strong><small>End this session</small></div></button>
    </div>}
  </div>
}

const cardPhotos = ['photoLake', 'photoMountain', 'photoNight', 'photoChicago']

function DashboardCard({ title, location, dates, status, tone, imageClass, detail, to }) {
  const app = useTripApp()
  const currentTrip = app.trip || trip
  return <Link className="dashboardTripCard" to={to || tripHref(currentTrip.id, 'plan')}>
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

function WorkspaceRouteGuard() {
  const location = useLocation()
  const app = useTripApp()
  const initialPathRef = useRef(location.pathname)
  const restorationResolvedRef = useRef(false)
  const restorationFactsPending = Boolean(
    !restorationResolvedRef.current &&
    location.pathname === initialPathRef.current &&
    app.currentUser &&
    app.hasAccountSession &&
    app.tripSummariesStatus === 'loading',
  )
  const restorationResolution = useMemo(() => {
    if (restorationResolvedRef.current) return null
    if (location.pathname !== initialPathRef.current) return null
    if (!app.currentUser || app.loading.initial) return null
    if (app.hasAccountSession && app.tripSummariesStatus !== 'ready') return null
    return resolveRestoredWorkspaceDestination({
      currentRoutePath: location.pathname,
      hasAccountSession: app.hasAccountSession,
      membershipId: app.membershipId,
      currentUser: app.currentUser,
      tripSummaries: app.tripSummaries,
      activeTrip: app.trip || trip,
      activeTripId: app.activeTripId,
      restoredTripId: app.restoredTripId,
    })
  }, [
    app.activeTripId,
    app.hasAccountSession,
    app.currentUser,
    app.loading.initial,
    app.membershipId,
    app.restoredTripId,
    app.trip,
    app.tripSummaries,
    app.tripSummariesStatus,
    location.pathname,
  ])
  const resolution = useMemo(() => resolveCurrentWorkspaceRoute({
    currentRoutePath: location.pathname,
    currentUser: app.currentUser,
    activeTrip: app.trip || trip,
    activeTripId: app.activeTripId,
  }), [app.activeTripId, app.currentUser, app.trip, location.pathname])

  useEffect(() => {
    if (restorationResolvedRef.current) return
    if (location.pathname !== initialPathRef.current) {
      restorationResolvedRef.current = true
      return
    }
    if (!app.currentUser || app.loading.initial) return
    if (!app.hasAccountSession || ['ready', 'failed', 'not-needed'].includes(app.tripSummariesStatus)) {
      restorationResolvedRef.current = true
    }
  }, [app.hasAccountSession, app.currentUser, app.loading.initial, app.tripSummariesStatus, location.pathname])

  if (restorationFactsPending) {
    return null
  }

  if (restorationResolution?.disposition === 'redirect') {
    return <Navigate to={restorationResolution.destinationHref} replace/>
  }

  if (resolution?.disposition === 'redirect') {
    return <Navigate to={resolution.destinationHref} replace/>
  }

  return <Outlet/>
}

function Home() {
  const app = useTripApp()
  // Guest 没有账户,也就没有跨 trip 的仪表盘。直连过来就送回他所在的那趟旅行。
  const currentTrip = app.trip || trip
  const roundOpen = app.activeRounds?.some(round => round.status === 'open')
  const proposalPending = app.activeProposals?.some(proposal => ['waiting_affected_members', 'escalated'].includes(proposal.status))
  return <main className="homePage">
    <header className="editorialNav"><Logo/><nav><Link className="active" to={workspaceHomeHref()}>MY TRIPS</Link><Link to={workspaceCreateHref()}>NEW TRIP</Link></nav><div className="editorialActions"><ActionBell/><ProfileMenu/></div></header>
    <section className="homeContent">
      <div className="dashboardMasthead">
        <div><span className="eyebrow">My trips</span><h1>Upcoming trips</h1><p>Pick up where the group left off.</p></div>
      </div>
      <Link className="createTripStrip featureCreateTrip" to={workspaceCreateHref()}><div><span className="roleChip">Create new trip</span><h2>Start a group trip frame</h2><p>Choose destination, dates, budget, and invite people when the frame is ready.</p></div><strong>New trip →</strong></Link>
      {roundOpen && <Link className="dashboardAlert" to={tripHref(currentTrip.id, 'updates')}><span>◇</span><div><strong>A group round is open</strong><p>One block is contested. Pick an option — it closes on its own.</p></div><b>Choose →</b></Link>}
      {proposalPending && <Link className="dashboardAlert" to={tripHref(currentTrip.id, 'updates')}><span>!</span><div><strong>A proposal is waiting for confirmation</strong><p>The current plan stays active until the affected members accept.</p></div><b>Review →</b></Link>}
      <section className="dashboardGrid">
        {app.trips.map((created, index) => <DashboardCard key={created.id} title={created.name} location={created.destination} dates={created.dates} status="Planning" tone="orange" imageClass={cardPhotos[index % cardPhotos.length]} detail="Ready to plan" to={tripHref(created.id, 'plan')}/>)}
        <DashboardCard title={currentTrip.name} location={currentTrip.destination} dates={currentTrip.dates || 'Aug 14–17'} status={currentTrip.status} tone="purple" imageClass="photoChicago" detail={roundOpen ? 'Round open' : proposalPending ? 'Awaiting confirmation' : 'Current plan'} to={tripHref(currentTrip.id, 'plan')} />
        {otherTrips.map(other => <DashboardCard key={other.id} title={other.name} location={other.destination} dates={other.dates} status={other.status} tone={other.tone} imageClass={other.photo} detail={other.detail}/>)}
      </section>
    </section>
  </main>
}

function TripShell({ children }) {
  const location = useLocation()
  const app = useTripApp()
  const currentUser = app.currentUser
  const currentTrip = useCurrentTrip()
  const pending = (app.activeRounds || []).filter(round => round.status === 'open').length +
    (app.activeProposals || []).filter(proposal => ['waiting_affected_members', 'escalated'].includes(proposal.status)).length
  const navigation = useMemo(() => buildWorkspaceNavigationModel({
    currentRoutePath: location.pathname,
    currentUser,
    activeTrip: currentTrip,
    activeTripId: app.activeTripId,
  }), [app.activeTripId, currentTrip, currentUser, location.pathname])
  // 组织者不是超级用户,只是多了几个「维护公共框架」的入口。
  // Plan / Chat / Updates / Preferences 三种角色完全一致。
  const isGuest = currentUser.role === 'guest'
  return <div className="tripPage">
    <header className="tripUnifiedHeader">
      {/* trip 页里 logo 和「My Trips」原本是两个指向同一处的链接,合并成一个返回入口 */}
      <div className="tripUnifiedBrand">
        {!navigation.contextHref
          ? <span className="brandBack" aria-label="Cadensy"><span className="logoMark">C</span><span>Cadensy</span></span>
          : <Link className="brandBack" to={navigation.contextHref}><span className="logoMark">T</span><span className="backArrow">←</span><span>My Trips</span></Link>}
      </div>
      <div className="tripUnifiedCenter">
        <div className="tripUnifiedTitleRow"><h1>{currentTrip.name}</h1><nav className="tripUnifiedTabs">
          {navigation.entries.map(entry => <Link key={entry.id} className={entry.active ? 'active' : ''} to={entry.href}>
            {tripNavigationLabels[entry.id] || entry.id}
            {entry.id === 'updates' && pending > 0 && <i>{pending}</i>}
          </Link>)}
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
    {/* 三种角色都标出来。参与者不显示标记会让人以为"没角色"，
        而参与者恰恰是这个产品里权利最完整的默认身份。 */}
    <><i/><span className={`pillRole role-${role}`}>{role === 'guest' ? 'Guest' : role === 'organizer' ? 'Organizer' : 'Participant'}</span></>
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
  const [roster, setRoster] = useState(null)
  const [reminded, setReminded] = useState({})
  const [remindingId, setRemindingId] = useState('')

  useEffect(() => {
    let cancelled = false
    app.loadMembers()
      .then(data => {
        if (cancelled) return
        // 后端只回答"交没交"，不回答"交了什么" —— 这一页永远看不到偏好内容。
        setRoster((data.members || []).map(member => ({
          id: member.membership_id,
          name: member.name,
          initials: (member.name || '?').split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(),
          role: member.role,
          isGuest: member.role === 'guest',
          joined: member.joined,
          preferencesSubmitted: member.preferences_submitted,
          isMe: member.is_me,
        })))
      })
      .catch(() => { if (!cancelled) setRoster([]) })
    return () => { cancelled = true }
  }, [app.loadMembers])

  const list = roster || []
  const submitted = list.filter(member => member.preferencesSubmitted).length
  const joined = list.filter(member => member.joined).length
  const remind = async member => {
    setRemindingId(member.id)
    try {
      await app.remindMember(member.id)
      setReminded(current => ({ ...current, [member.id]: true }))
      app.notify('Reminder sent')
    } catch (err) {
      app.notify(err.status === 429 ? 'You can remind each person once every 24 hours.' : 'Could not send the reminder.')
    } finally {
      setRemindingId('')
    }
  }
  return <TripShell>
    <div className="pageHeading editorialPageHeading"><div><span className="eyebrow">Members</span><h1>Who is on this trip</h1></div></div>
    <div className="memberStats">
      <div><strong>{joined}</strong><span>joined</span></div>
      <div><strong>{submitted}</strong><span>preferences in</span></div>
      <div><strong>{Math.max(0, list.length - submitted)}</strong><span>still waiting</span></div>
    </div>
    <section className="memberList">
      {roster === null && <p className="needsHint">Loading the roster...</p>}
      {list.map(member => <article className="memberRow" key={member.id}>
        <span className={cx('memberAvatar', !member.joined && 'pendingAvatar')}>{member.initials}</span>
        <div>
          <h3>{member.isMe ? `${member.name} (you)` : member.name}</h3>
          <p>{member.role === 'organizer' ? 'Organizer' : 'Participant'}{member.isGuest && ' · guest, no account'}{!member.joined && ' · invite not opened yet'}</p>
        </div>
        <span className={cx('memberState', member.preferencesSubmitted ? 'done' : 'waiting')}>{member.preferencesSubmitted ? 'Preferences in' : reminded[member.id] ? 'Reminded' : member.joined ? 'No preferences yet' : 'Not joined'}</span>
        {!member.preferencesSubmitted && !member.isMe && <button className="memberRemind" disabled={reminded[member.id] || remindingId === member.id} onClick={() => remind(member)}>{remindingId === member.id ? 'Sending...' : reminded[member.id] ? 'Reminded' : 'Remind'}</button>}
      </article>)}
    </section>
    <div className="organizerLimits">
      <h3>What you cannot do here</h3>
      <ul>
        <li>Fill in or edit anyone else's preferences</li>
        <li>Treat a non-reply as agreement</li>
        <li>Read hidden preference text — the same rule applies to the organizer</li>
        <li>Confirm a proposal on someone else's behalf</li>
      </ul>
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
  const remaining = Math.max(0, (round.closesAt || now) - now)
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
  const currentTrip = useCurrentTrip()
  const isOrganizer = app.currentUser.role === 'organizer'
  const myVote = round.myVote
  const voteCount = round.responded || 0
  const closed = round.status === 'closed'
  const winner = closed ? round.options.find(option => option.id === round.winningOptionId) : null
  const tally = round.tally || {}
  const leading = Math.max(1, ...Object.values(tally))
  const isReopen = round.kind === 'reopen'
  const planTarget = tripPlanHref(currentTrip.id, round.itemId)
  const extend = async () => {
    try {
      await app.extendRound(round.id)
      app.notify('Round extended')
    } catch (err) {
      app.notify(err.status === 409 ? 'This round has already been extended once.' : 'Could not extend this round.')
    }
  }
  return <article id={`round-card-${round.id}`} data-round-item-id={round.itemId || ''} className={cx('roundCard', compact && 'roundCardCompact', closed && 'roundClosed')}>
    <div className="roundHead">
      <div>
        <Badge tone={closed ? 'green' : 'blue'}>{closed ? 'Round closed' : isReopen ? 'Reopen round' : 'Group round'}</Badge>
        <h3>{closed ? `Settled: ${winner?.title}` : `This block is contested: ${round.itemTitle}`}</h3>
        <p>{closed
          ? 'Applied to the Current Plan. Members who did not respond are recorded as no preference, never as agreement.'
          : isReopen ? 'No response counts as keeping the current decision, so a change needs a clear majority.' : 'The whole group weighs in at once, so this is settled in one round instead of one conversation at a time.'}</p>
        {isReopen && round.reason && <p><strong>Reason:</strong> {round.reason}</p>}
      </div>
      <DeadlineRing round={round} closed={closed}/>
    </div>
    <div className="roundTally">
      <div className="voterDots" aria-label={`${voteCount} of ${round.totalMembers} responded`}>
        {Array.from({ length: round.totalMembers }, (_, i) => <i key={i} className={cx(i < voteCount && 'filled')}/>)}
      </div>
      <span>{voteCount} of {round.totalMembers} responded{!closed && (isReopen ? ' · no response counts as keeping the current decision' : ' · silence counts as no preference')}</span>
    </div>
    <div className="roundOptions">
      {round.options.map(option => {
        const count = tally[option.id] || 0
        return <button key={option.id} type="button" className={cx('roundOption', myVote === option.id && 'chosen', closed && round.winningOptionId === option.id && 'won')} disabled={closed || app.loading.action} onClick={() => app.castVote(round.id, option.id)}>
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
      <div className="roundFooterActions">
        {isOrganizer && <button type="button" className="roundDiscuss" disabled={app.loading.action} onClick={extend}>{app.loading.action ? 'Extending...' : 'Extend'}</button>}
        <button type="button" className="roundDiscuss" onClick={() => navigate(tripHref(currentTrip.id, 'conflict'))}>None of these work — discuss instead</button>
      </div>
    </div>}
    {closed && <div className="roundFooter">
      <span>The round has been settled.</span>
      <Link className="btn btnSecondary" to={planTarget}>View result in plan →</Link>
    </div>}
  </article>
}

// 新建的 trip 还没有行程。不伪造计划,而是显示偏好收集进度和下一步动作。
function NewTripPlan({ currentTrip }) {
  const app = useTripApp()
  const [progress, setProgress] = useState(null)
  const [generateError, setGenerateError] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const isOrganizer = app.currentUser.role === 'organizer'
  useEffect(() => {
    let cancelled = false
    app.loadMembers()
      .then(data => {
        if (cancelled) return
        const members = data.members || []
        setProgress({
          total: data.total ?? members.length,
          submitted: data.submitted ?? members.filter(member => member.preferences_submitted).length,
          meSubmitted: Boolean(members.find(member => member.is_me)?.preferences_submitted),
        })
      })
      .catch(() => {
        if (!cancelled) setProgress({ total: currentTrip.people || 1, submitted: 0, meSubmitted: false })
      })
    return () => { cancelled = true }
  }, [app.loadMembers, currentTrip.people])
  const total = Math.max(1, progress?.total || currentTrip.people || 1)
  const submitted = Math.min(total, progress?.submitted || 0)
  const missing = Math.max(0, total - submitted)
  const meSubmitted = Boolean(progress?.meSubmitted)
  const canGenerate = isOrganizer && meSubmitted && !app.loading.action
  const progressText = `${submitted} of ${total} people have shared what they need.`
  const generate = async () => {
    setGenerateError('')
    setBlockedReason('')
    try {
      const result = await app.generatePlan()
      if (result.status === 'blocked') {
        setBlockedReason(result.blocked_reason || 'The itinerary is blocked.')
        return
      }
      app.notify('Itinerary generated')
    } catch (err) {
      if (err.status === 422) setGenerateError('Share your own preferences first.')
      else if (err.status === 409) setGenerateError('An itinerary already exists.')
      else setGenerateError('Could not generate the itinerary. Try again in a moment.')
    }
  }
  return <>
    <div className="pageHeading editorialPageHeading"><div><span className="eyebrow">Current Plan</span><h1>No itinerary yet</h1><p>Waiting for preferences.</p></div></div>
    <div className="planEmptyPanel">
      <section className="collectPanel">
        <div className="collectHead">
          <div><span className="eyebrow">Collecting preferences</span><h3>{progressText}</h3></div>
          <span className="collectCount">{missing === 0 ? 'All set' : `${missing} waiting`}</span>
        </div>
        <div className="collectBar"><i style={{ width: `${Math.min(100, (submitted / total) * 100)}%` }}/></div>
        {!isOrganizer && <p className="fieldHint">Waiting for the organizer to generate the itinerary.</p>}
        {isOrganizer && !meSubmitted && <p className="fieldHint">Share your own preferences first; the itinerary should be checked against what you need too. <Link className="inlineAction" to={tripHref(currentTrip.id, 'preferences')}>Open preferences →</Link></p>}
        {isOrganizer && meSubmitted && missing > 0 && <div className="generateCopy"><p>{progressText}</p><p>{missing} {missing === 1 ? 'person has' : 'people have'} not shared theirs; their hard limits will not be taken into account.</p></div>}
        {isOrganizer && meSubmitted && missing === 0 && <p className="fieldHint">Everyone's requirements will be checked.</p>}
        {blockedReason && <div className="generationError"><strong>{blockedReason}</strong><p>You can loosen requirements or adjust the dates.</p></div>}
        {generateError && <p className="formError">{generateError}</p>}
        {currentTrip.deadline && <div className="collectDeadline"><span>◷</span><div><strong>Preferences deadline</strong><p>{currentTrip.deadline}</p></div></div>}
      </section>
      <div className="proposalCard tripFrameLine"><span>Trip frame</span><h3>{currentTrip.destination} · {currentTrip.dates}</h3><p>{currentTrip.assumptions || 'Share the invite link.'}</p></div>
      <div className="btnRow">
        {isOrganizer && <Button disabled={!canGenerate} onClick={generate}>{app.loading.action ? 'Generating...' : 'Generate itinerary'}</Button>}
        {isOrganizer && <Link className="btn btnSecondary" to={tripHref(currentTrip.id, 'members')}>See who's in →</Link>}
        <Link className="btn btnSecondary" to={tripHref(currentTrip.id, 'preferences')}>{submitted ? 'Edit my preferences' : 'Fill my preferences'}</Link>
      </div>
    </div>
  </>
}

const groupCommentsByItem = rows => (rows || []).reduce((grouped, comment) => {
  const itemId = comment.plan_item_id || comment.planItemId
  if (!itemId) return grouped
  grouped[itemId] = [...(grouped[itemId] || []), comment]
  return grouped
}, {})

function PlanPage() {
  const app = useTripApp()
  const currentUser = app.currentUser
  const currentTrip = useCurrentTrip()
  const location = useLocation()
  const [openDays, setOpenDays] = useState(['day2'])
  const [comments, setComments] = useState({})
  const [commenting, setCommenting] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentError, setCommentError] = useState('')
  const [menuOpen, setMenuOpen] = useState(null)
  const [drawerItem, setDrawerItem] = useState(null)
  const [drawerMode, setDrawerMode] = useState('ask')
  const [selectedTripItemId, setSelectedTripItemId] = useState(null)
  const [highlightedItemId, setHighlightedItemId] = useState(null)
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
  const days = useMemo(() => (app.days || []).map(day => ({ ...day, items: day.items.map(patched) })), [app.appliedPatches, app.days])
  const itemDayById = useMemo(() => Object.fromEntries(days.flatMap(day => day.items.map(item => [item.id, day.id]))), [days])
  const focusPlanItem = useCallback((itemId, target = 'item') => {
    if (!itemId) return
    setSelectedTripItemId(itemId)
    setHighlightedItemId(itemId)
    const dayId = itemDayById[itemId]
    if (dayId) setOpenDays(current => current.includes(dayId) ? current : [...current, dayId])
    window.setTimeout(() => {
      const roundCard = target === 'round' ? document.querySelector(`[data-round-item-id="${itemId}"]`) : null
      const itemCard = document.getElementById(`trip-item-${itemId}`)
      ;(roundCard || itemCard)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 120)
    window.setTimeout(() => setHighlightedItemId(current => current === itemId ? null : current), 1800)
  }, [itemDayById])
  const handleSelectTripItem = useCallback(itemId => focusPlanItem(itemId), [focusPlanItem])
  useEffect(() => {
    const focusItemId = new URLSearchParams(location.search).get('focus')
    if (focusItemId && days.length) focusPlanItem(focusItemId)
  }, [days.length, focusPlanItem, location.search])
  useEffect(() => {
    if (!app.loadComments || !days.length) return undefined
    let cancelled = false
    const load = async () => {
      try {
        const rows = await app.loadComments()
        if (!cancelled) {
          setComments(groupCommentsByItem(rows))
          setCommentError('')
        }
      } catch {
        if (!cancelled) setCommentError('Could not load group notes.')
      }
    }
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [app.loadComments, days.length])
  const railDays = railDay === 'all' ? days : days.filter(day => day.id === railDay)
  const toggleDay = id => setOpenDays(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id])
  const postComment = async id => {
    if (!commentDraft.trim()) return
    setCommentError('')
    try {
      const saved = await app.addComment(id, commentDraft.trim())
      setComments(current => ({
        ...current,
        [id]: [...(current[id] || []).filter(comment => comment.id !== saved.id), saved],
      }))
      setCommentDraft('')
      setCommenting(null)
      app.notify('Group note posted')
    } catch (err) {
      setCommentError(err.status === 422 ? 'Write a note before posting.' : 'Could not post this note.')
    }
  }
  const openDrawer = (item, mode, day) => {
    setDrawerItem(day ? { ...item, dayLabel: `${day.label} · ${day.date}` } : item)
    setDrawerMode(mode)
    setMenuOpen(null)
  }
  const toggleBooked = async item => {
    const nextBooked = item.settledness !== 'booked'
    setMenuOpen(null)
    try {
      await app.setItemBooked(item.id, nextBooked)
      app.notify(nextBooked ? 'Marked as booked' : 'Booked status removed')
    } catch (err) {
      app.notify(err.status === 404 ? 'This plan item no longer exists.' : 'Could not update booking status.')
    }
  }
  if (currentTrip.isCreated || (!app.loading.initial && days.length === 0)) return <TripShell><NewTripPlan currentTrip={currentTrip}/></TripShell>
  return <TripShell>
    <div className={cx('planSplit', !drawerItem && 'withMap', drawerItem && 'withAssistant')}>
      <section className="planMainPane">
        <div className="pageHeading planHeading"><div><span className="eyebrow">Current Plan</span><h1>Your shared itinerary</h1></div><div className="planHeadingActions"><Badge tone="blue">Live plan</Badge><Button secondary className="askCadensyBtn" onClick={() => openDrawer({ title: 'Full itinerary', place: currentTrip.destination, time: currentTrip.dates, note: 'Ask about the whole trip plan.' }, 'global')}>✦ Ask Cadensy</Button></div></div>
        {app.loading.initial && <div className="planNotice"><span>…</span><div><strong>Loading trip data</strong><p>Fetching the current plan from the backend.</p></div></div>}
        {app.error && <div className="planNotice"><span>!</span><div><strong>Backend request failed</strong><p>{app.error}</p></div><button type="button" onClick={app.refreshAll}>Retry</button></div>}
        {app.conflictCreated && !app.decisionResolved && <Link className="planNotice" to={tripHref(currentTrip.id, 'updates')}><span>!</span><div><strong>Proposed change waiting for confirmation</strong><p>A hard constraint is involved. The current plan remains active until the affected members accept.</p></div><b>Review →</b></Link>}
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
                  <article id={`trip-item-${item.id}`} className={cx('activityBlock', selectedTripItemId === item.id && 'selected', highlightedItemId === item.id && 'updatedFlash')} onClick={() => setSelectedTripItemId(item.id)}>
                    <span className="activityIndex"><b>{index + 1}</b></span>
                    <ActivityPhoto item={item}/>
                    <div className="activityMain"><div className="activityTitle"><div><small>{day.date}</small><h3>{item.title}</h3></div>{visibleStatus(item.status) && <Badge tone={statusTone(item.status)}>{visibleStatus(item.status)}</Badge>}</div><p className="activityMeta">⌖ {item.place} <span>•</span> ◷ {item.time}</p><p>{item.note}</p>{item.locked && <small className="lockedNote">🔒 Existing reservation</small>}</div>
                    <div className="activityActions"><button className="itemIconAction" title="Discuss" onClick={() => { setCommenting(commenting === item.id ? null : item.id); setMenuOpen(null) }}>💬{(comments[item.id] || []).length > 0 && <i>{comments[item.id].length}</i>}</button><button className="itemIconAction" title="Ask Cadensy" onClick={() => openDrawer(item, 'ask', day)}>✦</button><div className="moreWrap"><button className="moreBtn" onClick={() => setMenuOpen(menuOpen === item.id ? null : item.id)}>•••</button>{menuOpen === item.id && <div className="actionMenu"><button onClick={() => openDrawer(item, 'editTime', day)}>Edit time</button><button onClick={() => openDrawer(item, 'moveDay', day)}>Move to another day</button><button onClick={() => openDrawer(item, 'replacePlace', day)}>Replace place</button><button disabled={app.loading.action} onClick={() => toggleBooked(item)}>{item.settledness === 'booked' ? 'Remove booked status' : 'Mark as booked'}</button><button onClick={() => openDrawer(item, 'removePlan', day)}>Remove from plan</button><button onClick={() => openDrawer(item, 'details', day)}>View details</button></div>}</div></div>
                    {(comments[item.id] || []).length > 0 && <div className="publicThread">{comments[item.id].map((comment, i) => <div key={comment.id || `${item.id}-${i}`}><span>{comment.initials || comment.name.slice(0,2).toUpperCase()}</span><p><strong>{comment.name}</strong>{comment.text}</p></div>)}</div>}
                    {commenting === item.id && <div className="publicComposer"><label>Group note</label><textarea rows="2" value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder="Whole group can see this note." />{commentError && <p className="formError">{commentError}</p>}<div><button onClick={() => { setCommenting(null); setCommentDraft(''); setCommentError('') }}>Cancel</button><Button disabled={app.loading.action || !commentDraft.trim()} onClick={() => postComment(item.id)}>{app.loading.action ? 'Posting...' : 'Post note'}</Button></div></div>}
                  </article>
                  {app.activeRounds?.filter(round => round.itemId === item.id || round.itemTitle === item.title).map(round => <DecisionRoundCard key={round.id} round={round} compact/>)}
                  {index < day.items.length - 1 && <div className="routeSegment">
                    <span>Between stops</span>
                    <strong>{formatStraightLineDistance(item, day.items[index + 1])}</strong>
                    <button type="button" onClick={() => setRailDay(day.id)}>Map</button>
                  </div>}
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
      {drawerItem && <AssistantDrawer item={drawerItem} mode={drawerMode} onClose={() => setDrawerItem(null)} onOutcome={(outcome, committedItem) => {
        if (outcome.path === 'notice') {
          setDrawerItem(null)
          focusPlanItem(committedItem.id)
        } else if (outcome.path === 'round' || outcome.path === 'reopen_round') {
          setDrawerItem(null)
          focusPlanItem(committedItem.id, 'round')
        }
      }} inline/>}
    </div>
  </TripShell>
}

function AssistantDrawer({ item, mode, onClose, onOutcome, inline = false }) {
  const app = useTripApp()
  const navigate = useNavigate()
  const [pendingRedirect, setPendingRedirect] = useState('')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const threadEndRef = useRef(null)
  const threadRef = useRef(null)
  const inputRef = useRef(null)
  const actionLabels = {
    global: 'Ask Cadensy',
    ask: 'Ask Cadensy',
    editTime: 'Edit time',
    moveDay: 'Move to another day',
    replacePlace: 'Replace place',
    removePlan: 'Remove from plan',
    details: 'View details',
  }
  const promptExamples = {
    global: '',
    ask: '',
    editTime: '',
    moveDay: '',
    replacePlace: '',
    removePlan: '',
    details: '',
  }
  const placeholder = mode === 'global'
    ? 'Ask Cadensy or request a change...'
    : 'Ask about this item or request a change...'
  const itemId = mode === 'global' ? null : item.id
  const itemById = useMemo(() => Object.fromEntries((app.days || []).flatMap(day => day.items.map(planItem => [planItem.id, planItem]))), [app.days])
  useEffect(() => {
    setDraft(promptExamples[mode] || '')
    setMessages([])
    setPendingRedirect('')
    setSending(false)
  }, [item.id, mode])
  useEffect(() => {
    const thread = threadRef.current
    if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' })
  }, [messages, pendingRedirect])
  useEffect(() => {
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80)
  }, [item.id, mode])
  const updateMessage = (id, patch) => {
    setMessages(current => current.map(message => message.id === id ? { ...message, ...patch } : message))
  }
  const sendMessage = async () => {
    const text = draft.trim()
    if (!text || sending) return
    const loadingId = `ai-loading-${Date.now()}`
    const userMessage = { id: `user-${Date.now()}`, from: 'you', text }
    setMessages(current => [...current, userMessage, { id: loadingId, from: 'tripSync', text: 'Thinking...', loading: true }])
    setDraft('')
    setSending(true)
    try {
      const history = messages
        .filter(message => !message.loading && message.text)
        .map(message => ({
          role: message.from === 'you' ? 'user' : 'assistant',
          text: message.text,
        }))
      const result = await app.chatWithTrip({ message: text, itemId, history })
      setMessages(current => current.map(message => message.id === loadingId ? {
        ...message,
        loading: false,
        from: 'tripSync',
        text: result.reply,
        proposedChange: result.proposed_change,
        request: text,
      } : message))
    } catch (err) {
      const text = err.status === 409
        ? 'A vote is already open for this time block.'
        : err.status === 422
          ? 'Reopening this block needs a written reason.'
          : 'I could not reach the backend. Try again in a moment.'
      setMessages(current => current.map(message => message.id === loadingId ? { ...message, text, loading: false, error: true } : message))
    } finally {
      setSending(false)
    }
  }
  const dismissProposal = id => updateMessage(id, { proposedChange: null })
  const applyProposal = async (message, proposedChange) => {
    const targetItem = itemById[proposedChange.item_id] || (item.id === proposedChange.item_id ? item : { id: proposedChange.item_id, title: proposedChange.item_title })
    updateMessage(message.id, { applying: true, applyError: '' })
    try {
      const outcome = await app.submitChange({
        item: targetItem,
        actionType: mode,
        request: message.request,
        verdict: proposedChange.verdict,
        patch: proposedChange.patch,
      })
      if (!outcome) {
        updateMessage(message.id, { applying: false })
        return
      }
      updateMessage(message.id, { applying: false, applied: true })
      if (outcome.path === 'notice') {
        app.notify('Updated')
        onOutcome?.(outcome, targetItem)
      } else if (outcome.path === 'round' || outcome.path === 'reopen_round') {
        app.notify('Vote opened')
        onOutcome?.(outcome, targetItem)
      } else {
        setPendingRedirect('Affected members need to confirm. Opening the conversation...')
        window.setTimeout(() => navigate(tripHref((app.trip || trip).id, 'conflict')), 850)
      }
    } catch (err) {
      const applyError = err.status === 409
        ? 'A vote is already open for this time block.'
        : err.status === 422
          ? 'Reopening this block needs a written reason.'
          : 'I could not reach the backend. Try again in a moment.'
      updateMessage(message.id, { applying: false, applyError })
    }
  }
  const drawer = <aside className={cx('assistantDrawer', inline && 'inlineAssistant')} onClick={event => event.stopPropagation()}>
      <header><div><span className="eyebrow">{actionLabels[mode]}</span><h2>{item.title}</h2><p>{item.place} · {item.time}</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="drawerThread" ref={threadRef}>
        <div className="assistantBubbleRail"><i/><i/><i/></div>
        <ChatBubble from="tripSync">{mode === 'global' ? 'Ask me about the itinerary, or tell me what you want to adjust. If I can identify the item, I will show the change before anything is submitted.' : 'Ask me about this item, or tell me a change in your own words. I will check it first and show exactly what would be submitted.'}</ChatBubble>
        {messages.map(message => <div key={message.id}>
          <ChatBubble from={message.from}>{message.text}</ChatBubble>
          {message.proposedChange && <ChangeConfirmCard
            message={message}
            proposedChange={message.proposedChange}
            currentItem={itemById[message.proposedChange.item_id] || (item.id === message.proposedChange.item_id ? item : null)}
            showRecognizedItem={mode === 'global'}
            onApply={() => applyProposal(message, message.proposedChange)}
            onDismiss={() => dismissProposal(message.id)}
          />}
        </div>)}
        {mode === 'details' && <div className="detailSheet"><dl><div><dt>Time</dt><dd>{item.time}</dd></div><div><dt>Place</dt><dd>{item.place}</dd></div><div><dt>Status</dt><dd>{item.status || '—'}</dd></div><div><dt>Note</dt><dd>{item.note}</dd></div></dl></div>}
        {pendingRedirect && <p className="redirectHint">{pendingRedirect}</p>}
        <div ref={threadEndRef}/>
      </div>
      <div className="drawerComposer"><input ref={inputRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendMessage()} placeholder={placeholder}/><button aria-label="Send message" disabled={sending || !draft.trim()} onClick={sendMessage}>{sending ? '...' : '↑'}</button></div>
    </aside>
  if (inline) return drawer
  return <div className="drawerOverlay" onClick={onClose}>{drawer}</div>
}

function ChangeConfirmCard({ message, proposedChange, currentItem, showRecognizedItem, onApply, onDismiss }) {
  const [whyOpen, setWhyOpen] = useState(false)
  const verdict = proposedChange.verdict
  const patch = proposedChange.patch || {}
  const before = {
    title: currentItem?.title || proposedChange.item_title,
    place: currentItem?.place || '',
    time: currentItem?.time || formatPlanHour(currentItem?.startHour),
    // 只有时间没有日期，用户看不出这是改哪一天的 —— 换天的改动尤其分不清
    day: formatChangeDay(currentItem?.dayDate),
  }
  const after = {
    title: patch.title || before.title,
    place: patch.place || before.place,
    time: patch.start_hour !== undefined ? formatPlanHour(patch.start_hour) : before.time,
    day: formatChangeDay(patch.day_date || currentItem?.dayDate),
  }
  const canExplain = verdict?.path === 'confirm'
  return <div className={cx('changeConfirmCard', message.applied && 'done')}>
    {showRecognizedItem && <div className="recognizedItem"><span>Cadensy matched this to</span><strong>{proposedChange.item_title}</strong></div>}
    <div className="changeConfirmHead">
      <div><span>{pathLabels[verdict.path]}</span><h3>{proposedChange.item_title}</h3></div>
      {message.applied && <Badge tone="green">Done</Badge>}
    </div>
    <div className="changeCompare assistantChangeCompare">
      <div><small>Current{before.day ? ` · ${before.day}` : ''}</small><strong>{before.time} · {before.title}</strong><span>{before.place || 'Current place'}</span></div>
      <b>→</b>
      <div className="new"><small>Proposed{after.day ? ` · ${after.day}` : ''}</small><strong>{after.time} · {after.title}</strong><span>{after.place || before.place || 'Current place'}</span></div>
    </div>
    <p>{verdict.headline}</p>
    {canExplain && <button type="button" className="whyToggle" onClick={() => setWhyOpen(current => !current)}>{whyOpen ? 'Hide details' : 'Why?'}</button>}
    {canExplain && whyOpen && <ul className="verdictChecks">
      {verdict.checks?.map(check => <li key={check.id} className={cx(check.hit && 'hit')}>
        <span>{check.hit ? '✕' : '✓'}</span>
        <div><strong>{check.label}</strong>{check.hit && check.privateNote && <small>{check.privateNote}</small>}</div>
        <em>{check.hit ? 'hit' : 'clear'}</em>
      </li>)}
    </ul>}
    <div className="pathLadder">
      {[['notice','Notice'],['round','Round'],['confirm','Confirm']].map(([id,label]) => (
        <i key={id} className={cx((verdict.path === id || (id === 'round' && verdict.path === 'reopen_round')) && 'on')}>{label}</i>
      ))}
    </div>
    {message.applyError && <p className="assistantError">{message.applyError}</p>}
    <div className="miniAlternatives">
      <button onClick={onApply} disabled={message.applied || message.applying}>{message.applied ? 'Applied' : message.applying ? 'Applying...' : 'Apply'}</button>
      {!message.applied && <button onClick={onDismiss}>Not quite</button>}
    </div>
  </div>
}

function ChatBubble({ from, children }) {
  const app = useTripApp()
  const currentUser = app.currentUser
  const isUser = from === 'you'
  return <div className={cx('chatBubbleRow', isUser && 'mine')}>
    {!isUser && <span className="chatAvatar tripSync">C</span>}
    <div className={cx('drawerMessage', isUser ? 'mine' : 'assistant')}><strong>{isUser ? 'You' : 'Cadensy'}</strong><p>{children}</p></div>
    {isUser && <span className="chatAvatar user">{currentUser.initials}</span>}
  </div>
}

function ChatWorkspace({ thread }) {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const showTradeoff = Boolean(app.activeProposal && ['waiting_affected_members', 'escalated'].includes(app.activeProposal.status))
  return <TripShell>
    <div className="chatLayout">
      <aside className="conversationList">
        <div className="conversationHead"><span className="eyebrow">Conversations</span><h2>Chat</h2></div>
        <Link className={cx('conversation', thread === 'personal' && 'active')} to={tripHref(currentTrip.id, 'chat')}><span className="aiAvatar">C</span><div><strong>Cadensy</strong><small>Personal planning assistant</small></div></Link>
        {showTradeoff && <Link className={cx('conversation', thread === 'tradeoff' && 'active')} to={tripHref(currentTrip.id, 'conflict')}><span className="pairAvatar anon">◍</span><div><strong>Constraint tradeoff</strong><small>Anonymous · affected members only</small></div></Link>}
      </aside>
      {thread === 'tradeoff' && showTradeoff ? <TradeoffThread/> : thread === 'tradeoff' ? <EmptyTradeoffPanel tripId={currentTrip.id}/> : <PersonalThread/>}
    </div>
  </TripShell>
}

function EmptyTradeoffPanel({ tripId }) {
  return <section className="chatPanel">
    <header><div><span className="pairAvatar anon">◍</span><div><h2>Constraint tradeoff</h2><p>No active conversation</p></div></div></header>
    <div className="messages">
      <div className="emptyState quietEmptyState"><span></span><h2>Nothing to resolve</h2><p>Most changes never reach a conversation. One opens here only when a change touches a hard constraint that cannot be settled by choosing an option.</p><Link className="btn btnSecondary" to={tripHref(tripId, 'plan')}>Back to plan</Link></div>
    </div>
  </section>
}

function PersonalThread() {
  const app = useTripApp()
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    const loadingId = `ai-loading-${Date.now()}`
    setMessages(current => [...current, { from: 'you', text }, { id: loadingId, from: 'tripSync', text: 'Thinking...', loading: true }])
    setDraft('')
    setSending(true)
    try {
      const history = messages
        .filter(message => !message.loading && message.text)
        .map(message => ({
          role: message.from === 'you' ? 'user' : 'assistant',
          text: message.text,
        }))
      const result = await app.chatWithTrip({ message: text, itemId: null, history })
      setMessages(current => current.map(message => message.id === loadingId ? {
        ...message,
        loading: false,
        from: 'tripSync',
        text: result.proposed_change
          ? `${result.reply} I matched this to ${result.proposed_change.item_title}. Open that item in the plan to review and submit the change.`
          : result.reply,
      } : message))
    } catch (err) {
      const text = err.status === 409
        ? 'A vote is already open for this time block.'
        : err.status === 422
          ? 'Reopening this block needs a written reason.'
          : 'I could not reach the backend. Try again in a moment.'
      setMessages(current => current.map(message => message.id === loadingId ? { ...message, text, loading: false, error: true } : message))
    } finally {
      setSending(false)
    }
  }
  return <section className="chatPanel">
    <header><div><span className="aiAvatar">C</span><div><h2>Cadensy</h2><p>Just for you · not shared with the group</p></div></div><Badge>My AI</Badge></header>
    <div className="messages">
      <ChatBubble from="tripSync">This conversation is just between us. Ask about the plan, flag fatigue or weather, or request a change — nothing reaches the group until I have checked what it affects.</ChatBubble>
      {messages.map((message, index) => <ChatBubble from={message.from} key={message.id || `${message.from}-${index}`}>{message.text}</ChatBubble>)}
    </div>
    <div className="chatComposer"><button>＋</button><input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && send()} placeholder="Message Cadensy..."/><button className="sendBtn" disabled={sending || !draft.trim()} onClick={send}>{sending ? '…' : '↑'}</button></div>
  </section>
}

// 路径 C:只有受影响成员 + AI。除了当前用户,所有人匿名。
function TradeoffThread() {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const isOrganizer = app.currentUser.role === 'organizer'
  const [reply, setReply] = useState('')
  const [threadMessages, setThreadMessages] = useState([])
  const proposal = app.activeProposal
  if (!proposal) return null
  const { before, after, affectedMembers } = proposal
  const planTarget = tripPlanHref(currentTrip.id, proposal.sourceItemId)
  const applied = app.decisionResolved || proposal.status === 'applied'
  const unchanged = ['declined', 'withdrawn', 'expired'].includes(proposal.status)
  const escalated = proposal.status === 'escalated'
  const pending = !applied && !unchanged && proposal.status === 'waiting_affected_members'
  const escalate = async () => {
    try {
      await app.escalateProposal(proposal.id)
      app.notify('Sent to the organizer')
    } catch {
      app.notify('Could not escalate this proposal.')
    }
  }
  const resolveDeadlock = async action => {
    try {
      await app.resolveDeadlock(proposal.id, action)
      app.notify(action === 'split' ? 'Block split' : 'Block cleared')
    } catch {
      app.notify('Could not resolve this block.')
    }
  }
  const sendReply = () => {
    if (!reply.trim()) return
    setThreadMessages(current => [...current,
      { from: 'you', text: reply.trim() },
      { from: 'tripSync', text: 'Noted. The Current Plan stays unchanged until every affected member confirms.' },
    ])
    setReply('')
  }
  return <section className="chatPanel">
    <header><div><span className="pairAvatar anon">◍</span><div><h2>Constraint tradeoff</h2><p>{affectedMembers.length} affected members · anonymous</p></div></div><Badge tone={applied ? 'green' : unchanged ? 'blue' : 'orange'}>{applied ? 'Resolved' : unchanged ? 'Closed' : escalated ? 'With organizer' : 'Awaiting confirmation'}</Badge></header>
    <div className="messages conflictMessages">
      <div className="anonBanner"><span>◍</span><p>{proposal.privacyNote}</p></div>
      <div className="message ai"><span>✦</span><div><p>{proposal.headline}. {proposal.detail}</p><p>This could not be settled by picking an option, so it comes to the affected members directly. The person who proposed it counts as accepted.</p></div></div>
      <div className="changeCompare conflictCompare"><div><small>Current{before.dayLabel ? ` · ${before.dayLabel}` : ''}</small><strong>{before.time} · {before.title}</strong><span>{before.place}</span></div><b>→</b><div className="new"><small>Proposed{after.dayLabel ? ` · ${after.dayLabel}` : ''}</small><strong>{after.time} · {after.title}</strong><span>{after.place}</span></div></div>
      <div className="impactRow conflictImpactRow">{affectedMembers.map(member => <span key={member.id}>{applied || member.status === 'accepted' ? `${member.label}: accepted` : unchanged ? `${member.label}: closed` : `${member.label}: needs decision`}{member.proposer ? ' (proposer)' : ''}</span>)}<span>Names hidden</span><span>Personal reasons hidden</span></div>
      {pending && <div className="message ai"><span>✦</span><div><p>The Current Plan does not move until every affected member confirms.</p><div className="messageActions"><Button secondary onClick={() => app.resolveProposal(proposal.id, 'accepted')}>Accept</Button><Button ghost onClick={async () => { await app.resolveProposal(proposal.id, 'declined'); app.notify('Current plan kept') }}>Decline</Button><Button ghost disabled={app.loading.action} onClick={escalate}>{app.loading.action ? 'Sending...' : 'Escalate to organizer'}</Button></div></div></div>}
      {escalated && isOrganizer && <div className="message ai"><span>✦</span><div><p>The affected members could not agree. Choose how to leave this block undecided.</p><div className="messageActions"><Button secondary disabled={app.loading.action} onClick={() => resolveDeadlock('split')}>Split the block</Button><Button ghost disabled={app.loading.action} onClick={() => resolveDeadlock('clear')}>Clear the block</Button></div></div></div>}
      {escalated && !isOrganizer && <div className="message ai"><span>✦</span><div><p>Waiting for the organizer to handle this block.</p></div></div>}
      {threadMessages.map((message, index) => <ChatBubble from={message.from} key={`${message.from}-${index}`}>{message.text}</ChatBubble>)}
      {applied && <div className="message ai resolvedMessage"><span>✓</span><div><p>Every affected member confirmed. The Current Plan is updated and the booking is unchanged.</p><Link className="inlineAction" to={planTarget}>Back to updated plan →</Link></div></div>}
      {unchanged && <div className="message ai resolvedMessage"><span>↩</span><div><p>The proposal is closed. The Current Plan did not change.</p><Link className="inlineAction" to={planTarget}>Back to Current Plan →</Link></div></div>}
    </div>
    <div className="chatComposer"><button>＋</button><input value={reply} onChange={event => setReply(event.target.value)} onKeyDown={event => event.key === 'Enter' && sendReply()} placeholder="Reply anonymously in this conversation..."/><button className="sendBtn" onClick={sendReply}>↑</button></div>
  </section>
}

function UpdatesPage() {
  const app = useTripApp()
  const navigate = useNavigate()
  const currentTrip = useCurrentTrip()
  const openRounds = (app.activeRounds || []).filter(round => round.status === 'open')
  const pendingProposals = (app.activeProposals || []).filter(proposal => ['waiting_affected_members', 'escalated'].includes(proposal.status))
  const hasActions = openRounds.length > 0 || pendingProposals.length > 0
  return <TripShell>
    <div className="pageHeading editorialPageHeading"><div><h1>Trip notes</h1></div></div>
    <div className="updateFilters editorialUpdateTabs">
      <button className={app.updateFilter === 'all' ? 'active' : ''} onClick={() => app.setUpdateFilter('all')}>All</button>
      <button className={app.updateFilter === 'forYou' ? 'active' : ''} onClick={() => app.setUpdateFilter('forYou')}>For you</button>
      <button className={app.updateFilter === 'actions' ? 'active' : ''} onClick={() => app.setUpdateFilter('actions')}>Actions {hasActions && <i>{openRounds.length + pendingProposals.length}</i>}</button>
    </div>
    {app.loading.initial && <div className="planNotice"><span>…</span><div><strong>Loading updates</strong><p>Fetching actions and notices from the backend.</p></div></div>}
    {app.error && <div className="planNotice"><span>!</span><div><strong>Backend request failed</strong><p>{app.error}</p></div><button type="button" onClick={app.refreshAll}>Retry</button></div>}
    <section className="updatesList">
      {app.updateFilter === 'actions' && <>
        {!hasActions && <div className="emptyState quietEmptyState"><span></span><h2>No actions right now</h2></div>}
        {openRounds.map(round => <DecisionRoundCard key={round.id} round={round}/>)}
        {pendingProposals.map(proposal => <article className="decisionCard" key={proposal.id}>
          <div className="decisionTop"><div><Badge tone="orange">{proposal.status === 'escalated' ? 'With organizer' : 'Needs confirmation'}</Badge><h2>{proposal.headline}</h2><p>{proposal.status === 'escalated' ? 'The affected members could not agree. The organizer can split or clear this block.' : `${proposal.detail} You proposed this, so you already count as accepted.`}</p></div><span>{proposal.createdAt}</span></div>
          <div className="changeCompare"><div><small>Current{proposal.before.dayLabel ? ` · ${proposal.before.dayLabel}` : ''}</small><strong>{proposal.before.time} · {proposal.before.title}</strong><span>{proposal.before.place}</span></div><b>→</b><div className="new"><small>Proposed{proposal.after.dayLabel ? ` · ${proposal.after.dayLabel}` : ''}</small><strong>{proposal.after.time} · {proposal.after.title}</strong><span>{proposal.after.place}</span></div></div>
          <div className="impactRow">{proposal.affectedMembers.map(member => <span key={member.id}>{member.label}: {member.status === 'accepted' ? 'accepted' : 'needs decision'}</span>)}<span>Names hidden</span></div>
          <div className="decisionActions"><Button onClick={() => navigate(tripHref(currentTrip.id, 'conflict'))}>Open the conversation</Button>{proposal.status !== 'escalated' && <Button ghost onClick={() => { app.withdrawProposal(proposal.id); app.notify('Hidden — current plan kept') }}>Hide</Button>}</div>
        </article>)}
      </>}
      {app.updateFilter === 'all' && <>
        {(app.baseUpdates || []).length ? (app.baseUpdates || []).map(item => <article className="updateRow" key={item.id}><span className={`updateIcon ${item.kind}`}>{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p>{item.canObject && <button className="objectLink" onClick={async () => { await app.objectToNotice(item); app.setUpdateFilter('actions'); app.notify('Escalated to a group round') }}>I have a different idea →</button>}</div><time>{item.time}</time></article>)
          : <div className="emptyState quietEmptyState"><span></span><h2>No updates yet</h2><p>Activity for this trip will appear here once members join and preferences arrive.</p></div>}
      </>}
      {app.updateFilter === 'forYou' && <>
        {(app.personalUpdates || []).length ? <>
          {app.personalUpdates.map(item => <article className="updateRow" key={item.id}><span className={`updateIcon ${item.kind}`}>{item.icon}</span><div><h3>{item.title}</h3><p>{item.body}</p></div><time>{item.time}</time></article>)}
        </> : <div className="emptyState quietEmptyState"><span></span><h2>Nothing for you yet</h2><p>Mentions and replies that involve you will appear here.</p></div>}
      </>}
    </section>
  </TripShell>
}

// 六种约束，但用户看到的是六句自己会说的话 —— 没有人需要知道 "time_window" 是什么。
// AI 做好之后这些入口照样留着，只是多一个"直接说说看"的输入框，AI 预填参数。
const CONSTRAINT_KINDS = [
  { kind: 'time_window', label: "I can't do early mornings", hint: 'Or late nights' },
  { kind: 'budget_ceiling', label: 'I have a spending limit', hint: 'A ceiling, not a target' },
  { kind: 'walk_limit', label: "I can't walk far", hint: 'Per day' },
  { kind: 'dietary', label: 'I have a dietary requirement', hint: 'Meals must work for me' },
  { kind: 'date_range', label: "I'm only free on certain days", hint: 'Outside this I cannot come' },
  { kind: 'avoid_tag', label: 'There is something I want to avoid', hint: 'Not just a dislike' },
]

const DIET_TAGS = ['vegetarian', 'vegan', 'halal', 'gluten_free']
const AVOID_TAGS = ['nightlife', 'outdoor', 'shopping', 'family', 'music']
const VISIBILITY_OPTIONS = [
  { value: 'planning_only', label: 'Only Cadensy' },
  { value: 'organizer', label: 'Organizer too' },
  { value: 'everyone', label: 'Whole group' },
]

const defaultParams = kind => ({
  time_window: { earliest_hour: 9 },
  budget_ceiling: { max_total_per_person: 650 },
  walk_limit: { max_km_per_day: 3 },
  dietary: { required_tags: [] },
  date_range: { start: null, end: null },
  avoid_tag: { tags: [] },
}[kind] || {})

const labelFor = kind => CONSTRAINT_KINDS.find(entry => entry.kind === kind)?.label || kind
const visibilityLabel = value => VISIBILITY_OPTIONS.find(option => option.value === value)?.label || 'Only Cadensy'
const hourText = value => {
  if (value === null || value === undefined || value === '') return null
  const hour = Number(value)
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 || 12}:00 ${suffix}`
}
const constraintSummary = entry => {
  const params = entry.params || {}
  if (entry.kind === 'time_window') {
    const parts = []
    const earliest = hourText(params.earliest_hour)
    const latest = hourText(params.latest_hour)
    if (earliest) parts.push(`No activities before ${earliest}`)
    if (latest) parts.push(`No activities after ${latest}`)
    return parts.join('. ') || 'Time limit set'
  }
  if (entry.kind === 'budget_ceiling') return `Trip total must stay at or below $${params.max_total_per_person ?? 0}`
  if (entry.kind === 'walk_limit') return `No more than ${params.max_km_per_day ?? 0} km of walking per day`
  if (entry.kind === 'dietary') return (params.required_tags || []).length ? `Meals must support ${(params.required_tags || []).map(tag => tag.replace('_', ' ')).join(', ')}` : 'Dietary requirement set'
  if (entry.kind === 'date_range') return [params.start, params.end].filter(Boolean).length ? `Available from ${params.start || 'any start'} to ${params.end || 'any end'}` : 'Date limit set'
  if (entry.kind === 'avoid_tag') return (params.tags || []).length ? `Avoid ${(params.tags || []).join(', ')}` : 'Avoidance rule set'
  return 'Requirement set'
}

function ConstraintParams({ kind, params, onChange }) {
  const set = (key, value) => onChange({ ...params, [key]: value })
  const toggle = (key, tag) => {
    const list = params[key] || []
    set(key, list.includes(tag) ? list.filter(item => item !== tag) : [...list, tag])
  }
  if (kind === 'time_window') return <div className="constraintParams">
    <label>Not before<input type="number" min="0" max="23" value={params.earliest_hour ?? ''} onChange={e => set('earliest_hour', e.target.value === '' ? null : Number(e.target.value))}/></label>
    <label>Not after<input type="number" min="0" max="24" value={params.latest_hour ?? ''} onChange={e => set('latest_hour', e.target.value === '' ? null : Number(e.target.value))}/></label>
  </div>
  if (kind === 'budget_ceiling') return <div className="constraintParams">
    <label>No more than<input type="number" min="0" value={params.max_total_per_person ?? ''} onChange={e => set('max_total_per_person', Number(e.target.value))}/></label>
  </div>
  if (kind === 'walk_limit') return <div className="constraintParams">
    <label>Km per day<input type="number" min="0" step="0.5" value={params.max_km_per_day ?? ''} onChange={e => set('max_km_per_day', Number(e.target.value))}/></label>
  </div>
  if (kind === 'dietary') return <div className="constraintParams tagRow">
    {DIET_TAGS.map(tag => <button type="button" key={tag} className={cx('tagChip', (params.required_tags || []).includes(tag) && 'on')} onClick={() => toggle('required_tags', tag)}>{tag.replace('_', ' ')}</button>)}
  </div>
  if (kind === 'avoid_tag') return <div className="constraintParams tagRow">
    {AVOID_TAGS.map(tag => <button type="button" key={tag} className={cx('tagChip', (params.tags || []).includes(tag) && 'on')} onClick={() => toggle('tags', tag)}>{tag}</button>)}
  </div>
  return <div className="constraintParams">
    <label>From<input type="date" value={params.start || ''} onChange={e => set('start', e.target.value || null)}/></label>
    <label>Until<input type="date" value={params.end || ''} onChange={e => set('end', e.target.value || null)}/></label>
  </div>
}

function PreferencesPage() {
  const app = useTripApp()
  const currentTrip = useCurrentTrip()
  const [form, setForm] = useState(app.preferences)
  const [constraints, setConstraints] = useState([])
  const [conflicts, setConflicts] = useState([])
  const [picking, setPicking] = useState(false)
  const [draft, setDraft] = useState(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    app.loadMyPreferences()
      .then(data => {
        if (cancelled) return
        setConstraints(data.constraints || [])
        const pref = data.preference
        if (pref) setForm(current => ({
          ...current,
          preferredRange: {
            start: fromISODate(pref.preferred_start_date) || current.preferredRange.start,
            end: fromISODate(pref.preferred_end_date) || current.preferredRange.end,
          },
          availableRange: {
            start: fromISODate(pref.available_start_date) || current.availableRange.start,
            end: fromISODate(pref.available_end_date) || current.availableRange.end,
          },
          idealBudget: pref.ideal_budget ?? current.idealBudget,
          maxBudget: pref.maximum_budget ?? current.maxBudget,
          budgetVisibility: pref.budget_visibility || current.budgetVisibility,
          pace: pref.travel_style || current.pace,
          interests: pref.top_interests?.length ? pref.top_interests : current.interests,
        }))
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [app.loadMyPreferences])

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const toggleStyle = style => setForm(current => {
    const selected = current.interests || []
    if (selected.includes(style)) return { ...current, interests: selected.filter(item => item !== style) }
    if (selected.length >= 3) return { ...current, interests: [...selected.slice(1), style] }
    return { ...current, interests: [...selected, style] }
  })

  const startDraft = kind => {
    setPicking(false)
    setDraft({ kind, params: defaultParams(kind), importance: 'required', original_text: '', visibility: 'planning_only' })
  }

  const commitDraft = async () => {
    if (!draft) return
    try {
      const result = await app.addConstraint(draft)
      setConstraints(current => [...current, { id: result.id, ...draft }])
      setConflicts(result.conflicts || [])
      setDraft(null)
      app.notify(result.conflicts?.length ? 'Saved — it clashes with parts of the plan' : 'Saved')
    } catch { /* the provider already surfaced it */ }
  }

  const drop = async id => {
    try {
      await app.deleteConstraint(id)
      setConstraints(current => current.filter(entry => entry.id !== id))
      setConflicts(current => current.filter(entry => entry.constraint_id !== id))
    } catch { /* handled upstream */ }
  }

  const save = async () => {
    try {
      await app.saveMyPreferences({
        preferred_start_date: toISODate(form.preferredRange?.start),
        preferred_end_date: toISODate(form.preferredRange?.end),
        available_start_date: toISODate(form.availableRange?.start),
        available_end_date: toISODate(form.availableRange?.end),
        ideal_budget: Number(String(form.idealBudget).replace(/[^0-9.]/g, '')) || null,
        maximum_budget: Number(String(form.maxBudget).replace(/[^0-9.]/g, '')) || null,
        budget_visibility: form.budgetVisibility === 'planning' ? 'planning_only' : form.budgetVisibility,
        travel_style: form.pace,
        top_interests: form.interests || [],
      })
      app.submitPreferencesFor(currentTrip.id)
      app.notify('Preferences saved · shared anonymously')
    } catch { /* handled upstream */ }
  }

  return <TripShell>
    <div className="preferenceWrap editorialForm">
      <div className="pageHeading"><div><span className="eyebrow">My preferences</span><h1>Share only what matters.</h1></div></div>
      <section className="preferenceCard preferenceFlow">
        <div className="wide dateField"><label>Preferred dates — the trip you would ideally join</label><DateRangePicker value={form.preferredRange} onChange={range => set('preferredRange', range)}/></div>
        <details className="wide optionalPanel"><summary>Available date range — the widest window that still works for you</summary><div className="dateField" style={{ marginTop: 12 }}><DateRangePicker value={form.availableRange} onChange={range => set('availableRange', range)}/></div></details>
        <div className="wide fieldPair">
          <label>Ideal total budget<input value={form.idealBudget} onChange={e => set('idealBudget', e.target.value)}/></label>
          <label>Maximum acceptable budget<input value={form.maxBudget} onChange={e => set('maxBudget', e.target.value)}/></label>
        </div>
        <CustomSelect className="wide" label="Who can see my budget" value={form.budgetVisibility} onChange={value => set('budgetVisibility', value)} options={[{ value: 'planning', label: 'Only Cadensy' }, { value: 'organizer', label: 'Organizer too' }, { value: 'everyone', label: 'Whole group' }]}/>
        <CustomSelect className="wide" label="Preferred pace" value={form.pace} onChange={value => set('pace', value)} options={['Relaxed', 'Balanced', 'Full schedule'].map(option => ({ value: option, label: option }))}/>
        <div className="wide"><label>Top interests — up to 3</label><div className="styleGrid">{tripStyles.map(style => <button type="button" key={style} className={cx('styleTile', form.interests?.includes(style) && 'selected')} onClick={() => toggleStyle(style)}><span>{style}</span><small>{style === 'Food' ? 'better meals' : style === 'Nature' ? 'parks and views' : style === 'Relaxed' ? 'slower days' : style === 'Culture' ? 'museums and neighborhoods' : 'more active plans'}</small></button>)}</div></div>

        <div className="wide needsPanel">
          <label>Things that are not negotiable</label>
          <p className="needsHint">Only these are checked against the plan. Anything else, say it to the group.</p>
          {/* 隐私承诺只说一次，放在最私密的东西正上方 —— 说三遍反而像在极力保证。
              最后半句主动说破预算那个例外：承诺得比做到的多，是最伤信任的一种错。 */}
          <div className="privacyBox"><div><strong>Private by default</strong><p>Nobody sees this — not even the organizer.</p></div><Badge tone="green">Protected</Badge></div>
          {constraints.map(entry => <div className="needRow savedNeed" key={entry.id}>
            <div><strong>{labelFor(entry.kind)}</strong><small>{constraintSummary(entry)}</small><small className="needVisibility">Visible to: {visibilityLabel(entry.visibility)}</small></div>
            <Badge tone={entry.importance === 'required' ? 'orange' : 'blue'}>{entry.importance}</Badge>
            <button type="button" className="needRemove" aria-label="Remove" onClick={() => drop(entry.id)}>×</button>
          </div>)}

          {draft && <div className="needDraft">
            <strong>{labelFor(draft.kind)}</strong>
            <ConstraintParams kind={draft.kind} params={draft.params} onChange={params => setDraft(current => ({ ...current, params }))}/>
            <label>In your own words
              <input value={draft.original_text} placeholder="Optional" onChange={e => setDraft(current => ({ ...current, original_text: e.target.value }))}/>
            </label>
            <CustomSelect label="How strict is this?" value={draft.importance} onChange={value => setDraft(current => ({ ...current, importance: value }))} options={[{ value: 'required', label: 'Not negotiable' }, { value: 'flexible', label: 'Prefer, but flexible' }]}/>
            <CustomSelect label="Who can see this?" value={draft.visibility} onChange={value => setDraft(current => ({ ...current, visibility: value }))} options={VISIBILITY_OPTIONS}/>
            <div className="needDraftActions"><Button onClick={commitDraft}>Add</Button><Button ghost onClick={() => setDraft(null)}>Cancel</Button></div>
          </div>}

          {picking && !draft && <div className="needPicker">
            {CONSTRAINT_KINDS.map(entry => <button type="button" key={entry.kind} onClick={() => startDraft(entry.kind)}>
              <strong>{entry.label}</strong><small>{entry.hint}</small>
            </button>)}
          </div>}

          {!draft && <button type="button" className="needAdd" onClick={() => setPicking(current => !current)}>{picking ? 'Close' : '＋ Add something that is not negotiable'}</button>}
        </div>

        {conflicts.length > 0 && <div className="wide conflictPanel">
          <strong>This clashes with {conflicts.length} {conflicts.length === 1 ? 'part' : 'parts'} of the plan</strong>
          <p>Nothing was changed. You can adjust those blocks, or relax this requirement — that call is yours.</p>
          <ul>{conflicts.map((entry, index) => <li key={`${entry.constraint_id}-${index}`}>
            <span>{entry.item_title || 'The trip total'}</span>
            <small>{entry.day_date ? formatChangeDay(entry.day_date) : 'Whole trip'}{entry.settledness === 'booked' ? ' · already booked' : entry.settledness === 'settled' ? ' · already settled' : ''}</small>
          </li>)}</ul>
        </div>}

        <div className="formFooter"><span>{loaded ? '' : 'Loading your preferences...'}</span><Button disabled={app.loading.action} onClick={save}>{app.loading.action ? 'Saving...' : 'Save preferences'}</Button></div>
      </section>
    </div>
  </TripShell>
}

function AccountPage({ section = 'profile' }) {
  const app = useTripApp()
  const currentUser = app.currentUser
  const location = useLocation()
  const tabs = useMemo(() => buildWorkspaceNavigationModel({
    currentRoutePath: location.pathname,
    currentUser,
    activeTrip: app.trip || trip,
    activeTripId: app.activeTripId,
  }).entries, [app.activeTripId, app.trip, currentUser, location.pathname])
  const pages = {
    profile: {
      eyebrow: 'Account',
      title: 'Profile',
      body: 'Your account identity is used for trip membership and private planning context.',
      cards: [
        ['Display name', currentUser.name],
        ['Email', currentUser.email || 'No email on this account'],
        ['Account type', currentUser.isGuest ? 'Guest access' : 'Cadensy account'],
      ],
    },
    travel: {
      eyebrow: 'Defaults',
      title: 'Travel profile',
      body: 'These defaults will prefill future preference forms without showing private notes to the group.',
      cards: [
        ['Pace', 'Balanced days with room to rest'],
        ['Budget style', 'Mid-range by default'],
        ['Privacy', 'Only Cadensy unless you choose otherwise'],
      ],
    },
    notifications: {
      eyebrow: 'Alerts',
      title: 'Notifications',
      body: 'Choose which trip moments should ask for your attention.',
      cards: [
        ['Decision rounds', 'On'],
        ['Confirmations', 'On'],
        ['Daily summaries', 'Off'],
      ],
    },
    settings: {
      eyebrow: 'Preferences',
      title: 'Settings',
      body: 'Control privacy, display, and account-level defaults for Cadensy.',
      cards: [
        ['Privacy mode', 'Anonymous impact by default'],
        ['Appearance', 'System default'],
        ['Data controls', 'Connects when login is added'],
      ],
    },
  }
  const content = pages[section] || pages.profile
  return <div className="simplePage accountPage">
    <header className="editorialNav glassTop"><Logo/><nav><Link to={workspaceHomeHref()}>MY TRIPS</Link><Link to={workspaceCreateHref()}>NEW TRIP</Link></nav><div className="editorialActions"><ActionBell/><ProfileMenu/></div></header>
    <main className="accountShell">
      <aside className="accountSide">
        <span className="profilePhoto accountPhoto">{currentUser.initials}</span>
        <h2>{currentUser.name}</h2>
        <p>{currentUser.email || 'Guest account'}</p>
        <nav>{tabs.map(tab => <Link key={tab.id} className={tab.active ? 'active' : ''} to={tab.href}>{accountNavigationLabels[tab.id] || tab.id}</Link>)}</nav>
      </aside>
      <section className="accountPanel">
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.body}</p>
        <div className="accountCards">
          {content.cards.map(([label, value]) => <div className="accountCard" key={label}><span>{label}</span><strong>{value}</strong></div>)}
        </div>
        <div className="accountNotice"><strong>Coming next</strong><p>These pages are ready for the frontend flow. Saved account settings can connect when login and account APIs are added.</p></div>
      </section>
    </main>
  </div>
}

function CreateTrip() {
  const navigate = useNavigate()
  const app = useTripApp()
  const [dateRange, setDateRange] = useState({ start: null, end: null })
  const [form, setForm] = useState({ name: '', destination: '', theme: '', groupSize: '', currency: 'USD', budget: '', assumptions: '', deadline: '' })
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const canCreate = form.name.trim() && form.destination.trim() && dateRange.start && dateRange.end
  const [creating, setCreating] = useState(false)
  const createTrip = async () => {
    if (creating) return
    setCreating(true)
    try {
      // 后端要的是这几个字段。theme / assumptions 等目前后端不存，先不传，
      // 免得给人"填了会被用上"的错觉。
      const created = await app.createTrip({
        name: form.name.trim(),
        destination: form.destination.trim(),
        preferred_start_date: toISODate(dateRange.start),
        preferred_end_date: toISODate(dateRange.end),
        expected_group_size: Number(form.groupSize) || 1,
        currency: form.currency,
      })
      app.setInviteCopied(false)
      app.notify('Trip created')
      navigate(tripHref(created.id, 'invite'))
    } catch {
      /* provider already surfaced it */
    } finally {
      setCreating(false)
    }
  }
  return <div className="simplePage createPage"><header className="editorialNav glassTop"><Logo/><nav><Link to={workspaceHomeHref()}>MY TRIPS</Link><Link className="active" to={workspaceCreateHref()}>NEW TRIP</Link></nav><div className="editorialActions"><ActionBell/><ProfileMenu/></div></header><main className="createEditorial">
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
      <div className="formFooter wide"><span>Guests will choose dates and styles from this frame.</span><Button disabled={!canCreate || creating} onClick={createTrip}>{creating ? "Creating..." : "Create trip"}</Button></div>
    </section>
  </main></div>
}

function InvitePage() {
  const app = useTripApp()
  const navigate = useNavigate()
  const currentTrip = useCurrentTrip()
  const [invite, setInvite] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const inviteUrl = invite ? buildTripPreviewAbsoluteUrl(window.location.origin, joinHref(invite.token)) : ''
  useEffect(() => {
    let cancelled = false
    setLoadingInvite(true)
    setInviteError('')
    app.createInvite(currentTrip.id)
      .then(nextInvite => {
        if (!cancelled) setInvite(nextInvite)
      })
      .catch(err => {
        if (!cancelled) setInviteError(err.message || 'Could not create an invite link')
      })
      .finally(() => {
        if (!cancelled) setLoadingInvite(false)
      })
    return () => {
      cancelled = true
    }
  }, [app.createInvite, currentTrip.id])
  const copyLink = () => {
    if (!inviteUrl) return
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(inviteUrl).catch(() => {})
    app.setInviteCopied(true)
    app.notify('Invite link copied')
  }
  const revokeLink = async () => {
    if (!invite?.invite_id) return
    await app.revokeInvite(invite.invite_id)
    setInvite(null)
    app.setInviteCopied(false)
    app.notify('Invite link revoked')
  }
  return <TripShell>
    <div className="inviteManager">
      <section className="shareHero">
        <span className="eyebrow">Invite link</span>
        <h1>Share this trip with the group.</h1>
      </section>
      <section className="linkPanel">
        <div><span className="roleChip">{app.inviteCopied ? 'Link copied' : 'Ready to share'}</span><h2>{currentTrip.name}</h2><p>{currentTrip.destination} · {currentTrip.dates}</p></div>
        <label>Invite link<input readOnly value={loadingInvite ? 'Creating link...' : inviteError || inviteUrl}/></label>
        <div className="copyActions"><Button disabled={!inviteUrl} onClick={copyLink}>{app.inviteCopied ? 'Copied' : 'Copy link'}</Button><Button secondary onClick={() => navigate(tripHref(currentTrip.id, 'plan'))}>Start planning</Button>{invite && <Button ghost onClick={revokeLink}>Revoke link</Button>}</div>
        {app.inviteCopied && <div className="copiedState"><strong>Link ready to share</strong></div>}
        {inviteError && <div className="copiedState"><strong>{inviteError}</strong></div>}
      </section>
    </div>
  </TripShell>
}

function JoinInvitePage() {
  const app = useTripApp()
  const navigate = useNavigate()
  const { token } = useParams()
  const [preview, setPreview] = useState(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [joining, setJoining] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [error, setError] = useState('')
  const savedInviteSession = useMemo(() => app.readInviteAdoption(token), [app, token])
  const dateText = preview ? [formatInviteDate(preview.preferred_start_date), formatInviteDate(preview.preferred_end_date)].filter(Boolean).join(' – ') : ''
  useEffect(() => {
    let cancelled = false
    setLoadingInvite(true)
    setInvalid(false)
    app.getInvite(token)
      .then(data => {
        if (cancelled) return
        setPreview(data)
        if (
          savedInviteSession?.membershipId &&
          savedInviteSession?.tripId &&
          (
            app.membershipId !== savedInviteSession.membershipId ||
            app.activeTripId !== savedInviteSession.tripId
          )
        ) {
          app.adoptTechnicalTripContext({
            membershipId: savedInviteSession.membershipId,
            tripId: savedInviteSession.tripId,
            inviteToken: token,
          })
        }
      })
      .catch(err => {
        if (!cancelled) {
          setInvalid(err.status === 404)
          setError(err.status === 404 ? '' : (err.message || 'Could not load this invite'))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingInvite(false)
      })
    return () => {
      cancelled = true
    }
  }, [app.activeTripId, app.adoptTechnicalTripContext, app.getInvite, app.membershipId, savedInviteSession, token])
  const inviteOpenResolution = useMemo(() => {
    if (!token || (!preview && !invalid)) return null
    return resolveInviteJoinRoute({
      currentRoutePath: joinHref(token),
      currentUser: app.currentUser,
      activeTrip: app.trip || trip,
      activeTripId: app.activeTripId,
      membershipId: app.membershipId,
      token,
      step: 'open',
      invitePreview: preview,
      inviteErrorStatus: invalid ? 404 : null,
      inviteTripId: savedInviteSession?.tripId || null,
    })
  }, [app.activeTripId, app.currentUser, app.membershipId, app.trip, invalid, preview, savedInviteSession, token])
  useEffect(() => {
    if (inviteOpenResolution?.disposition === 'redirect') {
      navigate(inviteOpenResolution.destinationHref, { replace: true })
    }
  }, [inviteOpenResolution, navigate])
  const join = async withAccount => {
    if (!name.trim()) {
      setError('Enter your name to join this trip.')
      return
    }
    if (withAccount && !email.trim()) {
      setError('Enter an email address to join with an account.')
      return
    }
    setJoining(true)
    setError('')
    try {
      const joined = await app.joinInvite(token, {
        display_name: name.trim(),
        ...(withAccount ? { email: email.trim() } : {}),
      })
      app.adoptTechnicalTripContext({
        membershipId: joined.membership_id,
        tripId: joined.trip_id,
        inviteToken: token,
        profile: {
          name: name.trim(),
          email: withAccount ? email.trim() : null,
          role: withAccount ? joined.role : 'guest',
          isGuest: !withAccount,
        },
      })
      const completionResolution = resolveInviteJoinRoute({
        currentRoutePath: joinHref(token),
        currentUser: {
          tripId: joined.trip_id,
          role: withAccount ? joined.role : 'guest',
          isGuest: !withAccount,
        },
        activeTrip: {
          id: joined.trip_id,
        },
        activeTripId: joined.trip_id,
        membershipId: joined.membership_id,
        token,
        step: 'complete',
        joinResult: joined,
      })
      navigate(completionResolution.destinationHref, { replace: true })
    } catch (err) {
      if (err.status === 404) setInvalid(true)
      else setError(err.message || 'Could not join this trip')
    } finally {
      setJoining(false)
    }
  }
  if (invalid) {
    return <div className="invitePage">
      <header className="inviteGlass"><Logo/></header>
      <main className="inviteLayout">
        <section className="invitePanel">
          <span className="eyebrow">Invite unavailable</span><h2>This link is no longer active</h2>
          <p>Ask the organizer for a new invite link.</p>
        </section>
      </main>
    </div>
  }
  return <div className="invitePage">
    <header className="inviteGlass"><Logo/><div><strong>{preview?.name || 'Cadensy invite'}</strong></div></header>
    <main className="inviteLayout">
      <section className="invitePhoto"><div><Badge tone="blue">{dateText || 'Trip invite'}</Badge><h1>{preview?.destination || 'Join the group trip'} with the group.</h1></div></section>
      <section className="invitePanel">
        <span className="eyebrow">Join Cadensy</span><h2>{loadingInvite ? 'Loading invite' : preview?.name || 'You have been invited'}</h2>
        {preview && <p>{preview.destination} · {dateText || 'Dates to be confirmed'} · {preview.member_count} members · Organized by {preview.organizer_name}</p>}
        <label>Your name<input value={name} onChange={event => setName(event.target.value)} placeholder="Name shown in this trip"/></label>
        <Button disabled={joining || loadingInvite || !preview} onClick={() => join(false)}>{joining ? 'Joining...' : 'Continue as guest'}</Button>
        <div className="dividerText">or</div>
        <label>Email<input value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <Button secondary disabled={joining || loadingInvite || !preview} onClick={() => join(true)}>Join with an account</Button>
        {error && <p className="formError">{error}</p>}
      </section>
    </main>
  </div>
}

export default function FinalApp() {
  return <TripAppProvider><Routes>
    <Route path="*" element={<Navigate to="/" replace/>}/>
    <Route element={<WorkspaceRouteGuard/>}>
      <Route path="/" element={<Home/>}/>
      <Route path="/create" element={<CreateTrip/>}/>
      <Route path="/account/profile" element={<AccountPage section="profile"/>}/>
      <Route path="/account/travel" element={<AccountPage section="travel"/>}/>
      <Route path="/account/notifications" element={<AccountPage section="notifications"/>}/>
      <Route path="/account/settings" element={<AccountPage section="settings"/>}/>
      <Route path="/trip/:tripId/plan" element={<PlanPage/>}/>
      <Route path="/trip/:tripId/chat" element={<ChatWorkspace thread="personal"/>}/>
      <Route path="/trip/:tripId/conflict" element={<ChatWorkspace thread="tradeoff"/>}/>
      <Route path="/trip/:tripId/updates" element={<UpdatesPage/>}/>
      <Route path="/trip/:tripId/preferences" element={<PreferencesPage/>}/>
      <Route path="/trip/:tripId/members" element={<MembersPage/>}/>
      <Route path="/trip/:tripId/invite" element={<InvitePage/>}/>
    </Route>
    <Route path="/join/:token" element={<JoinInvitePage/>}/>
  </Routes><ScrollToTop/></TripAppProvider>
}
