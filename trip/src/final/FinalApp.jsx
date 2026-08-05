import { createContext, useContext, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { feedback, insights, members, planSections, trip } from './finalData'

const DemoContext = createContext(null)
const useDemo = () => useContext(DemoContext)

function DemoProvider({ children }) {
  const [guestStage, setGuestStage] = useState('preferences')
  const [inviteJoined, setInviteJoined] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [selectedSection, setSelectedSection] = useState(null)
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState('suggestion')
  const [visibility, setVisibility] = useState('organizer')
  const [saved, setSaved] = useState(false)
  const [planUpdated, setPlanUpdated] = useState(false)
  const [finalized, setFinalized] = useState(false)
  const [toast, setToast] = useState('')
  const [coverageChoice, setCoverageChoice] = useState('continue')
  const [draftCompareOpen, setDraftCompareOpen] = useState(false)
  const [manualEdit, setManualEdit] = useState(false)
  const [organizerPreferencesSubmitted, setOrganizerPreferencesSubmitted] = useState(false)
  const notify = message => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }
  const value = useMemo(() => ({ guestStage, setGuestStage, inviteJoined, setInviteJoined, inviteName, setInviteName, reviewed, setReviewed, selectedSection, setSelectedSection, note, setNote, noteType, setNoteType, visibility, setVisibility, saved, setSaved, planUpdated, setPlanUpdated, finalized, setFinalized, coverageChoice, setCoverageChoice, draftCompareOpen, setDraftCompareOpen, manualEdit, setManualEdit, organizerPreferencesSubmitted, setOrganizerPreferencesSubmitted, notify }), [guestStage, inviteJoined, inviteName, reviewed, selectedSection, note, noteType, visibility, saved, planUpdated, finalized, coverageChoice, draftCompareOpen, manualEdit, organizerPreferencesSubmitted])
  return <DemoContext.Provider value={value}>{children}{toast && <div className="toast">{toast}</div>}</DemoContext.Provider>
}

const cx = (...xs) => xs.filter(Boolean).join(' ')

function Button({ children, secondary, ghost, className, ...props }) {
  return <button className={cx('btn', secondary && 'btnSecondary', ghost && 'btnGhost', className)} {...props}>{children}</button>
}

function Badge({ children, tone = 'neutral' }) { return <span className={`badge badge-${tone}`}>{children}</span> }

function Logo() { return <Link to="/" className="logo"><span className="logoMark">T</span><span>TripSync</span></Link> }

function DashboardTripCard({ to, imageClass, when, title, meta, badge, badgeTone, action, progress }) {
  return <Link to={to} className="dashboardTripCard">
    <div className={`tripPhoto ${imageClass}`}><span>{when}</span></div>
    <div className="dashboardTripBody">
      <div className="tripTitle"><h2>{title}</h2><Badge tone={badgeTone}>{badge}</Badge></div>
      <p>{meta}</p>
      <div className="progressBar"><span style={{ width: progress }} /></div>
      <strong>{action} →</strong>
    </div>
  </Link>
}

function Home() {
  return <main className="homePage">
    <header className="topNav">
      <Logo />
      <nav><Link className="active" to="/">My Trips</Link><Link to="/organizer/create">New Trip</Link></nav>
      <AccountMenu />
    </header>
    <section className="homeContent">
      <div className="promoCard">
        <div><Badge tone="purple">Group trip planning</Badge><h1>Your group trips, all in one place.</h1><p>Open upcoming plans, review requests, and trips you created from the same dashboard.</p><Link className="btn" to="/organizer/create">+ New trip</Link></div>
        <div className="promoVisual"><div className="miniMap"/><div className="miniPlan"><span/><span/><span/></div></div>
      </div>
      <div className="dashboardHead"><div><span className="eyebrow">My Trips</span><h1>Recently viewed and upcoming trips</h1></div><Link className="btn" to="/organizer/create">+ New trip</Link></div>
      <section className="dashboardGrid">
        <DashboardTripCard to={`/organizer/trip/${trip.id}/collect`} imageClass="photoChicago" when="7 days" title={trip.name} meta="Organizer · Chicago · Aug 14–17" badge="Organizer" badgeTone="purple" action="Collect preferences" progress="38%" />
        <DashboardTripCard to={`/participant/trip/${trip.id}`} imageClass="photoLake" when="Needs review" title="Lake house weekend" meta="Participant · Lake Geneva · Sep 4–7" badge="Participant" badgeTone="blue" action="Review plan" progress="72%" />
        <DashboardTripCard to={`/organizer/trip/${trip.id}/final`} imageClass="photoMountain" when="Final" title="Annual ski weekend" meta="Organizer · Park City · Dec 3–7" badge="Final" badgeTone="green" action="Open final plan" progress="100%" />
      </section>
    </section>
  </main>
}

const organizerNav = [
  ['collect', 'Collect'], ['insights', 'Insights'], ['plan', 'Plan'], ['review', 'Review'], ['final', 'Final']
]

const tripFlowSteps = [
  ['collect', 'Preferences'],
  ['insights', 'Preference check'],
  ['plan', 'Draft itinerary'],
  ['review', 'Suggested adjustment'],
  ['final', 'Final plan'],
]

const guestFlowSteps = [
  ['preferences', 'Preferences'],
  ['review', 'Review'],
  ['final', 'Final'],
]

const calendarMonths = [
  { label: 'August 2026', month: 7 },
  { label: 'September 2026', month: 8 },
]

const makeDate = (month, day) => new Date(2026, month, day)
const suggestedTripRange = { start: makeDate(7, 14), end: makeDate(7, 17) }
const dayKey = date => date ? date.toISOString().slice(0, 10) : ''
const sameDay = (a, b) => a && b && dayKey(a) === dayKey(b)
const isBefore = (a, b) => dayKey(a) < dayKey(b)
const isAfter = (a, b) => dayKey(a) > dayKey(b)
const isWithin = (day, range) => range.start && range.end && !isBefore(day, range.start) && !isAfter(day, range.end)
const nightsBetween = range => range.start && range.end ? Math.max(0, Math.round((range.end - range.start) / 86400000)) : 0
const formatShortDate = date => date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Select'
const formatDateRange = range => range.start && range.end ? `${formatShortDate(range.start)} - ${formatShortDate(range.end)}, 2026` : 'Select dates'

const itineraryDays = [
  {
    id: 'day1', date: 'Fri, Aug 14', title: 'Arrival, Riverwalk, and first dinner', booking: 'Flexible', photoClass: 'photoChicago',
    highlights: ['Flexible arrivals', 'Riverwalk sunset', 'Casual group dinner'],
    route: 'Keep the first evening walkable from River North so late arrivals can join without a transfer.',
    why: 'This day stays low-pressure because arrival times vary. It gives the group one shared dinner without making anyone rush from the airport.',
    locations: ['River North hotel base', 'Chicago Riverwalk', 'Casual dinner nearby'],
    items: [
      { id: 'day1-checkin', time: '4:00 PM', title: 'Check in around River North', place: 'Hotel base', note: 'Central enough for transit and dinner.' },
      { id: 'day1-riverwalk', time: '6:00 PM', title: 'Riverwalk sunset walk', place: 'Chicago Riverwalk', note: 'Easy first shared activity.' },
      { id: 'day1-dinner', time: '7:30 PM', title: 'Casual welcome dinner', place: 'River North', note: 'No fixed menu yet.' },
    ],
  },
  {
    id: 'day2', date: 'Sat, Aug 15', title: 'Architecture cruise and birthday dinner', booking: 'Needs reservation', photoClass: 'photoLake',
    highlights: ['10:00 AM cruise', 'Free afternoon', 'Birthday dinner'],
    route: 'Use transit or rideshare to the dock, then keep dinner and rooftop plans close together.',
    why: 'This is the most important day because it carries the main celebration. The later cruise start protects the no-early-morning preference while keeping the birthday dinner intact.',
    locations: ['Architecture cruise dock', 'River North dinner', 'Rooftop drinks'],
    items: [
      { id: 'day2-cruise', time: '10:00 AM', title: 'Architecture cruise', place: 'Chicago River dock', note: 'Reservation needed after group approval.' },
      { id: 'day2-free', time: '1:00 PM', title: 'Free afternoon buffer', place: 'Loop / River North', note: 'Absorbs different energy levels.' },
      { id: 'day2-dinner', time: '7:00 PM', title: 'Birthday dinner', place: 'River North', note: 'Highest booking priority.' },
    ],
  },
  {
    id: 'day3', date: 'Sun, Aug 16', title: 'Neighborhood choice and shared evening', booking: 'Optional holds', photoClass: 'photoMountain',
    highlights: ['Brunch', 'Wicker Park or West Loop', 'Evening regroup'],
    route: 'Split the afternoon by interest, then regroup near the dinner area to avoid complex transfers.',
    why: 'A flexible afternoon lets food, culture, shopping, and rest preferences coexist without forcing one long activity on everyone.',
    locations: ['Brunch spot', 'Wicker Park option', 'West Loop option'],
    items: [
      { id: 'day3-brunch', time: '10:30 AM', title: 'Late brunch', place: 'Near hotel', note: 'Keeps the morning relaxed.' },
      { id: 'day3-choice', time: '12:30 PM', title: 'Choose a neighborhood lane', place: 'Wicker Park / West Loop', note: 'Group can split safely.' },
      { id: 'day3-regroup', time: '6:30 PM', title: 'Shared evening meetup', place: 'Dinner area', note: 'Locks the group back together.' },
    ],
  },
]

function DateRangePicker({ value, onChange, min, max, suggestedRange, caption }) {
  const disabled = day => (min && isBefore(day, min)) || (max && isAfter(day, max))
  const chooseDay = day => {
    if (disabled(day)) return
    if (!value.start || value.end) {
      onChange({ start: day, end: null })
      return
    }
    if (isBefore(day, value.start)) {
      onChange({ start: day, end: value.start })
      return
    }
    onChange({ start: value.start, end: day })
  }

  return <div className="rangeCalendar">
    <div className="rangeCalendarSummary">
      <div><span>Dates</span><strong>{formatDateRange(value)}</strong></div>
      <small>{value.start && value.end ? `${nightsBetween(value)} nights` : 'Choose a start and end date'}</small>
    </div>
    {caption && <p className="calendarCaption">{caption}</p>}
    <div className="calendarMonths">
      {calendarMonths.map(month => {
        const first = new Date(2026, month.month, 1).getDay()
        const count = new Date(2026, month.month + 1, 0).getDate()
        const blanks = Array.from({ length: first }, (_, index) => <span className="calendarBlank" key={`blank-${index}`} />)
        const days = Array.from({ length: count }, (_, index) => {
          const day = new Date(2026, month.month, index + 1)
          const inSelectedRange = isWithin(day, value)
          const inSuggestedRange = suggestedRange && isWithin(day, suggestedRange)
          return <button
            type="button"
            key={dayKey(day)}
            disabled={disabled(day)}
            className={cx(
              sameDay(day, value.start) && 'rangeStart',
              sameDay(day, value.end) && 'rangeEnd',
              inSelectedRange && 'inRange',
              inSuggestedRange && 'suggested',
            )}
            onClick={() => chooseDay(day)}
          >
            {index + 1}
          </button>
        })
        return <section className="calendarMonth" key={month.label}>
          <h3>{month.label}</h3>
          <div className="weekdayRow">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={`${d}-${i}`}>{d}</span>)}</div>
          <div className="calendarGrid">{blanks}{days}</div>
        </section>
      })}
    </div>
  </div>
}

function FlowHeader({ role, steps, active, backTo, children }) {
  const activeIndex = Math.max(0, steps.findIndex(([id]) => id === active))
  return <header className="flowHeader">
    <div className="flowIdentity">
      <Logo />
      {backTo && <Link to={backTo} className="topBackLink">← Back to My Trips</Link>}
      <div><span>{role}</span><strong>{trip.name}</strong></div>
    </div>
    <nav className="flowStepper" aria-label={`${role} flow`}>
      {steps.map(([id, label, href], index) => {
        const state = index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'upcoming'
        const content = <><i>{index + 1}</i><span>{label}</span></>
        return href
          ? <Link key={id} className={state} to={href}>{content}</Link>
          : <span key={id} className={state}>{content}</span>
      })}
    </nav>
    <div className="flowActions">{children}</div>
  </header>
}

function OrganizerShell({ children }) {
  const location = useLocation()
  const demo = useDemo()
  const isTripView = location.pathname.includes('/trip/')
  const activeStep = location.pathname.split('/').filter(Boolean).pop()
  const flowSteps = tripFlowSteps.map(([id, label]) => [id, label, `/organizer/trip/${trip.id}/${id}`])
  const submittedCount = demo.organizerPreferencesSubmitted ? 4 : 3
  return <div className="appShell">
    <div className="appMain">
      {isTripView ? <FlowHeader role="Trip planning" steps={flowSteps} active={activeStep} backTo="/">
        <Link className={cx('btn btnSecondary selfPrefsNav', !demo.organizerPreferencesSubmitted && 'attention')} to={`/organizer/trip/${trip.id}/preferences`}>{demo.organizerPreferencesSubmitted ? 'My preferences ✓' : 'Submit my preferences'}</Link>
        <div className="topStatus"><Badge tone="green">Live plan</Badge><span>{submittedCount} responses · review closes Friday</span></div>
        <AccountMenu label="Trip organizer" />
      </FlowHeader> : <header className="organizerTop">
        <div className="organizerTopLeft"><Logo /></div>
        <AccountMenu />
      </header>}
      <div className="page">{children}</div>
    </div>
  </div>
}

function AccountMenu({ label = 'Organizer workspace' } = {}) {
  const demo = useDemo()
  return <details className="accountMenu">
    <summary>
      <div className="accountBlock"><span className="eyebrow">{label}</span><strong>Emma Carter</strong></div>
      <div className="avatar">EC</div>
    </summary>
    <div className="accountDropdown">
      <div className="accountDropdownHead"><div className="avatar">EC</div><div><strong>Emma Carter</strong><span>emma.carter@example.com</span></div></div>
      <Link to="/organizer/account">○ Account</Link>
      <Link to="/organizer/settings">⚙ Settings</Link>
      <button type="button" onClick={() => demo.notify('Signed out for demo')}>↗ Sign out</button>
    </div>
  </details>
}

function WorkspaceTabs({ active }) {
  return <nav className="workspaceTabs" aria-label="Trip workspace sections">
    <Link className={active === 'active' ? 'active' : ''} to="/organizer"><span>Active trips</span><Badge tone="blue">2</Badge></Link>
    <Link className={active === 'archived' ? 'active' : ''} to="/organizer/archived"><span>Archived</span><Badge>2</Badge></Link>
  </nav>
}

function OrganizerTrips({ archived = false }) {
  return <OrganizerShell><div className="pageHeading"><div><span className="eyebrow">Workspace</span><h1>My Trips</h1><p>{archived ? 'Completed and paused trips are kept here for reference.' : 'Trips that need your attention appear first.'}</p></div><Link className="btn" to="/organizer/create">＋ Create trip</Link></div>
    <WorkspaceTabs active={archived ? 'archived' : 'active'} />
    {archived ? <ArchivedTripsList /> : <ActiveTripsList />}
  </OrganizerShell>
}

function ActiveTripsList() {
  return <>
    <section className="workspaceSummary">
      <article><span>Current focus</span><strong>Collect missing preferences</strong><p>Liam is in progress. Ethan has not opened the invite.</p></article>
      <article><span>Next decision</span><strong>Generate plan from 4 responses</strong><p>Missing guests are excluded until they submit.</p></article>
      <article><span>Plan quality</span><strong>All known must-haves feasible</strong><p>Private constraints remain summarized, not exposed.</p></article>
    </section>
    <div className="sectionLabel">Needs your attention <span>1</span></div>
    <Link to={`/organizer/trip/${trip.id}/collect`} className="tripCard">
      <div className="tripThumb photoChicago"><span>Chicago</span></div>
      <div className="tripDate"><strong>14</strong><span>AUG</span></div>
      <div className="tripCardBody"><div className="tripTitle"><h2>{trip.name}</h2><Badge tone="purple">Organizer</Badge></div><p>{trip.destination} · {trip.dates}</p><div className="progressBar"><span style={{ width: '38%' }} /></div><small>4 of 6 preferences submitted · Review closes Friday</small></div>
      <div className="tripAction"><Badge tone="orange">Collecting</Badge><strong>Review responses →</strong></div>
    </Link>
    <div className="sectionLabel">Upcoming <span>1</span></div>
    <div className="tripCard mutedCard"><div className="tripThumb photoMountain"><span>Park City</span></div><div className="tripDate"><strong>03</strong><span>DEC</span></div><div className="tripCardBody"><div className="tripTitle"><h2>Annual ski weekend</h2><Badge>Participant</Badge></div><p>Park City, Utah · December 3-7, 2026</p><small>Final plan published · No action needed</small></div><div className="tripAction"><Badge tone="green">Final</Badge></div></div>
  </>
}

function ArchivedTripsList() {
  return <>
    <section className="archiveSummary">
      <article><strong>2 archived trips</strong><p>Older plans stay searchable without competing with active work.</p></article>
      <article><strong>Last archived</strong><p>Napa birthday weekend · July 2026</p></article>
    </section>
    <div className="sectionLabel">Archived trips <span>2</span></div>
    <div className="tripCard archivedCard"><div className="tripThumb photoLake"><span>Napa</span></div><div className="tripDate"><strong>10</strong><span>JUL</span></div><div className="tripCardBody"><div className="tripTitle"><h2>Napa birthday weekend</h2><Badge>Archived</Badge></div><p>Napa Valley, California · July 10-13, 2026</p><small>Final itinerary kept for reference · 6 participants</small></div><div className="tripAction"><Badge>Closed</Badge><strong>View summary →</strong></div></div>
    <div className="tripCard archivedCard"><div className="tripThumb photoChicago"><span>Boston</span></div><div className="tripDate"><strong>22</strong><span>MAY</span></div><div className="tripCardBody"><div className="tripTitle"><h2>Boston graduation trip</h2><Badge>Archived</Badge></div><p>Boston, Massachusetts · May 22-25, 2026</p><small>Plan completed · feedback exported</small></div><div className="tripAction"><Badge>Closed</Badge><strong>View summary →</strong></div></div>
  </>
}

function AccountPage() {
  const demo = useDemo()
  const [profile, setProfile] = useState({ name: 'Emma Carter', email: 'emma.carter@example.com', phone: '+1 (312) 555-0148', timezone: 'America/Chicago' })
  const update = (key, value) => setProfile(current => ({ ...current, [key]: value }))
  return <OrganizerShell><PageIntro eyebrow="Account" title="Account profile" action={<Button onClick={() => demo.notify('Account profile saved')}>Save changes</Button>}>Manage the identity shown to invited participants and other organizers.</PageIntro>
    <section className="accountGrid">
      <div className="panel profilePanel"><div className="profileHero"><div className="avatar bigAvatar">EC</div><div><h2>{profile.name}</h2><p>Organizer · TripSync workspace owner</p></div></div><div className="profileMeta"><span><strong>Visible name</strong>{profile.name}</span><span><strong>Login email</strong>{profile.email}</span><span><strong>Workspace role</strong>Organizer</span></div></div>
      <form className="panel accountForm">
        <label><span>Full name</span><input value={profile.name} onChange={e => update('name', e.target.value)} /></label>
        <label><span>Email</span><input type="email" value={profile.email} onChange={e => update('email', e.target.value)} /></label>
        <label><span>Phone</span><input value={profile.phone} onChange={e => update('phone', e.target.value)} /></label>
        <label><span>Timezone</span><select value={profile.timezone} onChange={e => update('timezone', e.target.value)}><option>America/Chicago</option><option>America/New_York</option><option>America/Los_Angeles</option></select></label>
      </form>
    </section>
  </OrganizerShell>
}

function SettingsPage() {
  const demo = useDemo()
  const [settings, setSettings] = useState({ email: true, reminders: true, privateSummary: true, autoArchive: false })
  const toggle = key => setSettings(current => ({ ...current, [key]: !current[key] }))
  return <OrganizerShell><PageIntro eyebrow="Settings" title="Workspace settings" action={<Button onClick={() => demo.notify('Settings saved')}>Save settings</Button>}>Control organizer notifications, privacy defaults, and trip lifecycle behavior.</PageIntro>
    <section className="panel settingsPanel">
      {[
        ['email', 'Email updates', 'Receive response, review, and final-plan notifications.'],
        ['reminders', 'Smart reminders', 'Suggest reminders for participants who are late or in progress.'],
        ['privateSummary', 'Protect private inputs by default', 'Summarize protected constraints without exposing original text.'],
        ['autoArchive', 'Auto-archive completed trips', 'Move finalized trips into Archived after 30 days.'],
      ].map(([key, title, detail]) => <button type="button" className={settings[key] ? 'settingRow enabled' : 'settingRow'} onClick={() => toggle(key)} key={key}><span><strong>{title}</strong><small>{detail}</small></span><i>{settings[key] ? 'On' : 'Off'}</i></button>)}
    </section>
  </OrganizerShell>
}


function CreateTripPage() {
  const demo = useDemo()
  const [created, setCreated] = useState(false)
  const [dateRange, setDateRange] = useState(suggestedTripRange)
  const [form, setForm] = useState({
    name: "Mia's 30th in Chicago",
    destination: 'Chicago, Illinois',
    flexibility: 'fixed',
    size: '6',
    currency: 'USD',
    assumptions: 'Relaxed pace, central stay, shared dinners, and no activities before 9:00 AM unless everyone agrees.',
    deadline: 'Friday, August 7 at 6:00 PM',
  })
  const inviteLink = 'http://127.0.0.1:5173/trip-app/#/t/chicago-birthday'
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const selectedDates = formatDateRange(dateRange)

  if (created) {
    return <OrganizerShell><div className="createTripLayout"><PageIntro eyebrow="Create trip" title="Invite link ready">Share this link with the group. People can review the basics first, then join as a guest or with an account.</PageIntro>
      <section className="panel createdTripPanel">
        <div><Badge tone="green">Trip created</Badge><h2>{form.name}</h2><p>{form.destination} · {selectedDates} · {form.flexibility === 'fixed' ? 'fixed dates' : 'flexible dates'} · expected group size {form.size}</p></div>
        <div className="inviteUrl"><span>{inviteLink}</span><Button secondary onClick={() => demo.notify('Invite link copied')}>Copy link</Button><Link className="btn btnSecondary" to="/t/chicago-birthday">Open invite page</Link></div>
        <div className="inviteRules"><strong>Invite behavior</strong><span>One trip has one main invite link.</span><span>Opening the link does not automatically join the trip.</span><span>Membership is created only after the person confirms as guest or logs in.</span></div>
      </section>
      <div className="finalActions"><Link className="btn btnSecondary" to="/">Back to My Trips</Link><Link className="btn" to={`/organizer/trip/${trip.id}/collect`}>Go to collect preferences</Link></div>
    </div>
    </OrganizerShell>
  }

  return <OrganizerShell><div className="createTripLayout"><PageIntro eyebrow="Create trip" title="Start a new group trip">Set the trip basics, choose a date window, and share one invite link with the group.</PageIntro>
    <form className="panel createTripForm" onSubmit={e => { e.preventDefault(); setCreated(true) }}>
      <label><span>Trip name</span><input value={form.name} onChange={e => update('name', e.target.value)} /></label>
      <label><span>Destination</span><input value={form.destination} onChange={e => update('destination', e.target.value)} /></label>
      <fieldset className="dateChoice dateModeChoice">
        <legend>Date flexibility</legend>
        <div>
          <button type="button" className={form.flexibility === 'fixed' ? 'selected' : ''} onClick={() => update('flexibility', 'fixed')}><span>Fixed dates</span><strong>Guests choose within this window</strong></button>
          <button type="button" className={form.flexibility === 'flexible' ? 'selected' : ''} onClick={() => update('flexibility', 'flexible')}><span>Flexible dates</span><strong>Guests can suggest another range</strong></button>
        </div>
      </fieldset>
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        suggestedRange={suggestedTripRange}
        caption={form.flexibility === 'fixed' ? 'This range becomes the trip window.' : 'This range is the organizer suggestion. Guests may propose a different range.'}
      />
      <div className="formRow"><label><span>Expected group size</span><input type="number" min="2" value={form.size} onChange={e => update('size', e.target.value)} /></label><label><span>Currency</span><select value={form.currency} onChange={e => update('currency', e.target.value)}><option>USD</option><option>CAD</option><option>EUR</option><option>GBP</option></select></label></div>
      <label><span>Shared trip assumptions</span><textarea rows="4" value={form.assumptions} onChange={e => update('assumptions', e.target.value)} /></label>
      <label><span>Preferences deadline</span><input value={form.deadline} onChange={e => update('deadline', e.target.value)} /></label>
      <div className="formActions"><Link className="btn btnSecondary" to="/">Cancel</Link><Button disabled={!dateRange.start || !dateRange.end}>Create trip and generate invite</Button></div>
    </form>
  </div>
  </OrganizerShell>
}

function OrganizerPreferencesPage() {
  return <OrganizerShell><PageIntro eyebrow="My preferences" title="Submit your own preferences">You are organizing this trip, but you are also a member of the group. These answers are included in the same planning logic as everyone else's.</PageIntro><Preferences organizerMode /></OrganizerShell>
}

function PageIntro({ eyebrow, title, children, action }) { return <div className="pageHeading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}</div> }

function CollectPage() {
  const nav = useNavigate()
  const demo = useDemo()
  const visibleMembers = members.map(m => m.role === 'Organizer' ? { ...m, status: demo.organizerPreferencesSubmitted ? 'Submitted' : 'Not started' } : m)
  const submittedCount = visibleMembers.filter(m => m.status === 'Submitted').length
  const inProgressCount = visibleMembers.filter(m => m.status === 'In progress').length
  const notStartedCount = visibleMembers.filter(m => m.status === 'Not started').length
  const responseCoverage = Math.round((submittedCount / trip.people) * 100)
  return <OrganizerShell><PageIntro eyebrow="Step 1 of 5" title="Collect preferences" action={<Button disabled={!demo.organizerPreferencesSubmitted} onClick={() => nav(`/organizer/trip/${trip.id}/insights`)}>Continue with {submittedCount} responses →</Button>}>See who has responded. The organizer is also a trip member, so Emma's own preferences must be submitted before planning.</PageIntro>
    <section className={cx('panel organizerPreferenceCard', demo.organizerPreferencesSubmitted && 'submitted')}>
      <div><span className="memberAvatar">EM</span><div><Badge tone={demo.organizerPreferencesSubmitted ? 'green' : 'orange'}>{demo.organizerPreferencesSubmitted ? 'Submitted' : 'Required'}</Badge><h2>My preferences as a trip member</h2><p>Emma is counted in the group plan. Her budget, dates, and must-haves need to be submitted just like every other participant.</p></div></div>
      <Link className="btn" to={`/organizer/trip/${trip.id}/preferences`}>{demo.organizerPreferencesSubmitted ? 'Edit my preferences' : 'Fill my preferences'}</Link>
    </section>
    <div className="notice noticeBlue"><strong>Response window open</strong><span>{trip.deadline}</span><Button secondary onClick={() => demo.notify('Invitation link copied')}>Copy invitation link</Button></div>
    <div className="metricRow"><Metric value={`${submittedCount} / ${trip.people}`} label="Submitted"/><Metric value={String(inProgressCount)} label="In progress"/><Metric value={String(notStartedCount)} label="Not started"/><Metric value={`${responseCoverage}%`} label="Response coverage"/></div>
    <section className="panel"><div className="panelHeader"><div><h2>Participants</h2><p>Organizer and participant submission status is visible here. Private preferences remain protected.</p></div><Button secondary onClick={() => demo.notify('Reminders sent to pending participants')}>Remind pending</Button></div>
      <div className="memberList">{visibleMembers.map(m => <div className={cx('memberRow', m.role === 'Organizer' && 'memberSelf')} key={m.name}><span className="memberAvatar">{m.avatar}</span><div><strong>{m.name}</strong><small>{m.role}{m.role === 'Organizer' ? ' · trip member' : ''}</small></div><span className="spacer"/><Badge tone={m.status === 'Submitted' ? 'green' : m.status === 'In progress' ? 'orange' : 'neutral'}>{m.status}</Badge>{m.role === 'Organizer' ? <Link className="textBtn" to={`/organizer/trip/${trip.id}/preferences`}>{demo.organizerPreferencesSubmitted ? 'Edit response' : 'Submit preferences'}</Link> : m.status !== 'Submitted' && <button className="textBtn" onClick={() => demo.notify(`Reminder sent to ${m.name}`)}>Send reminder</button>}</div>)}</div>
    </section>
    <section className="panel decisionPanel"><div><span className="eyebrow">Organizer decision</span><h2>Continue now or wait?</h2><p>{demo.organizerPreferencesSubmitted ? 'Continuing now is allowed, but the generated plan will explicitly state that two invitees are not represented.' : 'Submit your own preferences first. Organizer preferences are part of the group input, not only workspace settings.'}</p></div><div className="decisionOptions"><button className={demo.coverageChoice === 'continue' ? 'selected' : ''} disabled={!demo.organizerPreferencesSubmitted} onClick={() => { demo.setCoverageChoice('continue'); demo.notify('Plan will continue with current coverage') }}><strong>Continue with current coverage</strong><span>{demo.organizerPreferencesSubmitted ? 'Fastest path · clearly disclosed' : 'Locked until organizer response is submitted'}</span></button><button className={demo.coverageChoice === 'wait' ? 'selected' : ''} onClick={() => { demo.setCoverageChoice('wait'); demo.notify('Review window kept open') }}><strong>Wait for more responses</strong><span>Fairer plan · slower progress</span></button></div></section>
    <div className="notice noticeWarn"><strong>Continue without everyone?</strong><span>{demo.organizerPreferencesSubmitted ? `This plan will reflect ${submittedCount} submitted responses. Liam and Ethan are not represented until they submit.` : 'Emma has not submitted her organizer-member preferences yet, so planning cannot fairly continue.'}</span></div>
  </OrganizerShell>
}

function Metric
({ value, label }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }

function InsightsPage() {
  const nav = useNavigate()
  return <OrganizerShell><PageIntro eyebrow="Step 2 of 5" title="Group insights" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/plan`)}>Generate recommended plan →</Button>}>Rules calculate overlap and summarize trade-offs without exposing private responses.</PageIntro>
    <div className="insightGrid">{insights.map(x => <article className={`insight insight-${x.tone}`} key={x.label}><span>{x.label}</span><strong>{x.value}</strong><p>{x.detail}</p></article>)}</div>
    <div className="twoCol"><section className="panel"><div className="panelHeader"><div><h2>Availability overlap</h2><p>Submitted respondents only</p></div><Badge tone="green">Feasible</Badge></div><CalendarStrip/><div className="aiBox"><span>✦</span><div><strong>Why this window works</strong><p>August 14–17 is the only three-night window shared by every submitted respondent.</p></div></div></section>
      <section className="panel"><div className="panelHeader"><div><h2>Main planning trade-off</h2><p>Budget ↔ central location</p></div><Badge tone="orange">1 trade-off</Badge></div><div className="tradeScale"><div><strong>Lower cost</strong><span>Stay farther out</span></div><div className="tradeLine"><i/></div><div><strong>Central stay</strong><span>+$38 per person</span></div></div><div className="privateBox"><span>🔒</span><div><strong>Private constraints protected</strong><p>The recommended plan can satisfy all submitted must-haves. Original private text is not shown.</p></div></div></section></div>
    <section className="panel"><div className="panelHeader"><div><h2>What the plan will prioritize</h2><p>Priority order is explicit and reviewable.</p></div></div><div className="priorityList"><span><b>1</b>Submitted must-haves</span><span><b>2</b>Shared availability</span><span><b>3</b>Comfortable budgets</span><span><b>4</b>Approval blockers</span><span><b>5</b>Flexible preferences</span></div></section>
  </OrganizerShell>
}

function CalendarStrip() { return <div className="calendarStrip">{['12 Wed','13 Thu','14 Fri','15 Sat','16 Sun','17 Mon','18 Tue'].map((d,i) => <div className={i >= 2 && i <= 5 ? 'selected' : ''} key={d}><strong>{d.split(' ')[0]}</strong><span>{d.split(' ')[1]}</span><small>{i >= 2 && i <= 5 ? '4/4' : i === 1 ? '3/4' : '2/4'}</small></div>)}</div> }

function AiExplanation({ explanation }) {
  const confidence = explanation.confidence.replace('AI synthesis', 'Generated summary').replace('AI estimate', 'Estimate').replace('AI recommendation', 'Recommendation')
  return <details className="aiExplanation"><summary><span>✦</span><strong>Why this works</strong><em>{confidence}</em></summary><div className="aiDetail"><p>{explanation.why}</p><div><strong>What it satisfies</strong>{explanation.satisfies.map(x => <span key={x}>✓ {x}</span>)}</div><div><strong>Trade-off</strong><span>{explanation.tradeoff}</span></div></div></details>
}

function PlanCard({ section, reviewMode, onComment, onAcceptSection, organizerMode, onOrganizerComment, organizerComment }) {
  const badge = section.badge.replace('AI estimate', 'Estimate')
  return <article className={`planCard planCard-${section.id}`} id={section.id}><div className="planMedia"><span>{section.title.split(' · ')[0]}</span></div><div className="planCardTop"><span className="planIcon">{section.icon}</span><div><h2>{section.title}</h2><p>{section.summary}</p></div><Badge tone={badge.includes('review') ? 'orange' : 'neutral'}>{badge}</Badge></div><div className="planFacts">{section.details.map(x => <span key={x}>{x}</span>)}</div><AiExplanation explanation={section.explanation}/>{organizerComment && <div className="organizerComment"><strong>Organizer comment</strong><p>{organizerComment}</p></div>}{organizerMode && <div className="sectionActions organizerSectionActions"><span>Add context before sending this plan to the group.</span><Button secondary onClick={() => onOrganizerComment(section)}>{organizerComment ? 'Edit comment' : 'Add comment'}</Button></div>}{reviewMode && <div className="sectionActions"><span>Does this section work for you?</span><button className="textBtn" onClick={() => onAcceptSection(section)}>✓ Works for me</button><Button secondary onClick={() => onComment(section)}>Request changes</Button></div>}</article>
}

function InlineCommentComposer({ item, value, onChange, onSave, onCancel }) {
  return <div className="inlineCommentComposer" id="organizerCommentComposer"><div className="composerHead"><span>Anonymous comment on</span><strong>{item.title}</strong><button onClick={onCancel}>×</button></div><textarea rows="2" value={value} onChange={e => onChange(e.target.value)} placeholder="Add a concern or suggested change. Your name will not be shown."/><div className="composerFoot"><span>Visible to everyone · anonymous</span><Button disabled={!value.trim()} onClick={onSave}>Send</Button></div></div>
}

function TripPlanOverview() {
  return <section className="tripPlanOverview">
    <article><span>Trip summary</span><h2>{trip.name}</h2><p>Three nights in Chicago built around food, architecture, a birthday dinner, and a relaxed pace.</p><div><Badge tone="green">Aug 14-17</Badge><Badge tone="purple">6 travelers</Badge><Badge tone="blue">$612 estimate pp</Badge></div></article>
    <article><span>Stay overview</span><h2>River North base</h2><p>Boutique hotel area near transit, dinner plans, and the river. Prices are estimates until booking is verified.</p><div><Badge>2 rooms</Badge><Badge tone="orange">Verify price</Badge><Badge tone="green">Central</Badge></div></article>
  </section>
}

function ItineraryItem({ item, index, comments = [], reaction, likeCount, onReact, onComment, activeComment, commentDraft, onDraftChange, onSaveComment, onCancelComment }) {
  const commentCount = comments.length
  return <article className={cx('itineraryItem placeBlock', activeComment && 'commentOpen')}><div className="itemPin">{index + 1}</div><div className="placeCard"><div className={`placePhoto ${item.photoClass || ''}`}></div><div className="placeContent"><div className="placeTitle"><span>⌖</span><h3>{item.title}</h3></div><p className="placeMeta">◷ {item.time} · {item.place}</p><p className="placeDesc">{item.note}</p></div><div className="placeQuickActions"><button className={reaction === 'like' ? 'selected' : ''} onClick={() => onReact(item.id, 'like')} aria-label="Like this place">👍 {likeCount > 0 ? likeCount : ''}</button><button onClick={() => onComment(item)} aria-label="Comment on this place">💬 {commentCount > 0 ? commentCount : ''}</button></div></div>{commentCount > 0 && <div className="anonymousThread">{comments.map((text, i) => <div className="anonymousComment" key={`${item.id}-${i}`}><span>{i + 1}</span><p>{text}</p></div>)}</div>}{activeComment && <InlineCommentComposer item={item} value={commentDraft} onChange={onDraftChange} onSave={onSaveComment} onCancel={onCancelComment} />}</article>
}

function ItineraryDay({ day, open, comments, reactions, likeCounts, activeCommentId, commentDraft, onDraftChange, onSaveComment, onCancelComment, onToggle, onReact, onComment }) {
  const needsBooking = day.booking.toLowerCase().includes('reservation')
  return <article className={cx('itineraryDay', open && 'open')}>
    <button className="dayHeader" onClick={onToggle} aria-expanded={open}>
      <div><span>{day.date}</span><h2>{day.title}</h2></div>
      <div className="dayHighlights">{day.highlights.map(x => <small key={x}>{x}</small>)}</div>
      <Badge tone={needsBooking ? 'orange' : 'green'}>{day.booking}</Badge>
      <i>{open ? '−' : '+'}</i>
    </button>
    <div className="dayBody"><div className="dayBodyInner"><section className="dayTimeline">{day.items.map((item, index) => <ItineraryItem key={item.id} item={{ ...item, photoClass: day.photoClass }} index={index} comments={comments[item.id]} reaction={reactions[item.id]} likeCount={likeCounts[item.id] || 0} onReact={onReact} onComment={onComment} activeComment={activeCommentId === item.id} commentDraft={commentDraft} onDraftChange={onDraftChange} onSaveComment={onSaveComment} onCancelComment={onCancelComment} />)}</section></div></div>
  </article>
}

function DraftItinerary({ comments, reactions, likeCounts, openDays, activeCommentId, commentDraft, onDraftChange, onSaveComment, onCancelComment, onToggleDay, onReact, onComment }) {
  return <section className="draftItinerary"><TripPlanOverview />{itineraryDays.map(day => <ItineraryDay key={day.id} day={day} open={openDays.includes(day.id)} comments={comments} reactions={reactions} likeCounts={likeCounts} activeCommentId={activeCommentId} commentDraft={commentDraft} onDraftChange={onDraftChange} onSaveComment={onSaveComment} onCancelComment={onCancelComment} onToggle={() => onToggleDay(day.id)} onReact={onReact} onComment={onComment} />)}</section>
}

function ItineraryPlanExperience({ participantMode = false, onSendForReview }) {
  const demo = useDemo()
  const [openDays, setOpenDays] = useState(['day2'])
  const [commentSection, setCommentSection] = useState(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [comments, setComments] = useState({
    'day2-dinner': ['Could we confirm a quieter table for dinner?'],
    'day2-cruise': ['Later start helps. Please keep this after 9:30.'],
  })
  const [reactions, setReactions] = useState({})
  const [likeCounts, setLikeCounts] = useState({ 'day2-dinner': 3, 'day2-cruise': 2 })
  const openComment = item => {
    setCommentSection(item)
    setCommentDraft('')
    window.setTimeout(() => document.getElementById('organizerCommentComposer')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 20)
  }
  const saveComment = () => {
    setComments(current => ({ ...current, [commentSection.id]: [...(current[commentSection.id] || []), commentDraft.trim()] }))
    setCommentSection(null)
    setCommentDraft('')
    demo.notify('Anonymous comment saved')
  }
  const reactToItem = (id, value) => {
    setReactions(current => {
      const nextValue = current[id] === value ? null : value
      setLikeCounts(counts => ({ ...counts, [id]: Math.max(0, (counts[id] || 0) + (nextValue === 'like' ? 1 : current[id] === 'like' ? -1 : 0)) }))
      return { ...current, [id]: nextValue }
    })
    demo.notify('Feedback saved')
  }
  const toggleDay = id => setOpenDays(current => current.includes(id) ? current.filter(day => day !== id) : [...current, id])
  const commentCount = Object.values(comments).reduce((total, xs) => total + xs.length, 0)
  const likedCount = Object.values(likeCounts).reduce((total, count) => total + count, 0)
  return <div className="planLayout itineraryLayout"><main><DraftItinerary comments={comments} reactions={reactions} likeCounts={likeCounts} openDays={openDays} activeCommentId={commentSection?.id} commentDraft={commentDraft} onDraftChange={setCommentDraft} onSaveComment={saveComment} onCancelComment={() => { setCommentSection(null); setCommentDraft('') }} onToggleDay={toggleDay} onReact={reactToItem} onComment={openComment} /></main><aside className="summaryRail"><h3>Live group feedback</h3><div className="healthItem"><span>Open days</span><strong>{openDays.length}</strong></div><div className="healthItem"><span>👍 total</span><strong>{likedCount}</strong></div><div className="healthItem"><span>Anonymous comments</span><strong>{commentCount}</strong></div><div className="healthItem"><span>Needs booking</span><strong>1 day</strong></div><hr/><h3>Feedback rule</h3><p>Everyone can see comments and like counts, but names are hidden. No action means the item is acceptable.</p>{!participantMode && <Button className="wideBtn" onClick={onSendForReview}>Send for group review →</Button>}</aside></div>
}

function PlanPage() {
  const nav = useNavigate()
  const demo = useDemo()
  return <OrganizerShell><PageIntro eyebrow="Draft itinerary" title="Draft itinerary" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/review`)}>Send for group review →</Button>}>Review the same itinerary participants will see. Multiple days can stay open while you compare the plan.</PageIntro>
    <div className="notice noticePurple"><strong>Draft itinerary</strong><span>Day 2 starts open because it has the birthday dinner and reservation risk. Open any other day without closing it.</span><Button secondary onClick={() => demo.notify('New draft generated')}>Regenerate</Button></div>
    <ItineraryPlanExperience onSendForReview={() => nav(`/organizer/trip/${trip.id}/review`)} />
  </OrganizerShell>
}

function ReviewOrganizerPage() {
  const demo = useDemo(); const nav = useNavigate()
  return <OrganizerShell><PageIntro eyebrow="Step 4 of 5" title="Review feedback" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/final`)}>Check approval readiness →</Button>}>Comments are grouped by plan section. Suggestions do not block approval; required changes do.</PageIntro>
    <div className="metricRow"><Metric value="4 / 6" label="Reviewed"/><Metric value="3" label="Accepted"/><Metric value="1" label="Needs changes"/><Metric value="2" label="Not reviewed"/></div>
    <div className="twoCol reviewCols"><section className="panel"><div className="panelHeader"><div><h2>Feedback by section</h2><p>Private notes are summarized without member identity.</p></div></div>{feedback.map((f,i) => <div className="feedbackCard" key={f.section}><div className="feedbackTitle"><div><h3>{f.section}</h3><Badge tone={f.kind === 'Needs adjustment' ? 'orange' : 'blue'}>{f.kind}</Badge></div><span>{f.count} response{f.count > 1 ? 's' : ''}</span></div><p>"{f.note}"</p><div className="aiSuggestion"><strong>Suggested update</strong><p>{f.suggestion}</p><small>{f.impact}</small></div><div className="feedbackActions"><Button onClick={() => { i === 0 && demo.setPlanUpdated(true); demo.notify(i === 0 ? 'Suggested update applied' : 'Information update added') }}>{i === 0 && demo.planUpdated ? 'Applied ✓' : 'Apply suggestion'}</Button><Button secondary onClick={() => demo.notify('Current version kept')}>Keep current</Button><button className="textBtn" onClick={() => { demo.setManualEdit(true); demo.notify('Manual edit opened') }}>Edit manually</button></div>{demo.manualEdit && i === 0 && <textarea className="manualEdit" rows="3" defaultValue="Move the cruise to 10:00 AM and keep lunch 45 minutes later."/>}</div>)}</section>
      <aside className="panel approvalPanel"><div className="panelHeader"><div><h2>Approval readiness</h2><p>Based on required review actions</p></div></div><div className="checklist compact"><div><span>✓</span><p><strong>3 accepted</strong>No changes requested by these reviewers</p></div><div><span>!</span><p><strong>1 needs changes</strong>Day 2 start time blocks approval until resolved</p></div><div><span>!</span><p><strong>2 not reviewed</strong>Not counted as approval yet</p></div></div></aside></div>
  </OrganizerShell>
}

function FinalOrganizerPage() {
  const demo = useDemo()
  return <OrganizerShell><PageIntro eyebrow="Step 5 of 5" title="Finalize the trip">Publish only after the group approval threshold and all submitted must-haves pass.</PageIntro>
    <div className="approvalHero"><div className="approvalRing">80<small>%</small></div><div><Badge tone="green">Group approved</Badge><h2>Approval threshold reached</h2><p>4 of 5 eligible reviewers accepted. One participant has not reviewed and is not counted as approval.</p></div></div>
    <section className="panel checklist"><h2>Final checks</h2><div><span>✓</span><p><strong>Submitted must-haves</strong>All satisfied by the current plan</p></div><div><span>✓</span><p><strong>Group approval</strong>80% approval · threshold 70%</p></div><div><span>✓</span><p><strong>Required adjustments</strong>Day 2 start-time issue resolved</p></div><div><span>!</span><p><strong>Response coverage</strong>Plan represents 4 of 6 invited participants</p></div></section>
    <section className="decisionSummary"><span className="eyebrow">Decision summary</span><h2>Why this plan is ready</h2><p>It fits every submitted availability window, stays within most comfortable budgets, and satisfies all protected must-haves. The Day 2 start moved later after participant feedback. Two invited members did not submit preferences and are not represented.</p></section>
    <div className="finalActions"><Button secondary onClick={() => { demo.setGuestStage('final'); demo.notify('Participant preview ready') }}>Preview participant view</Button><Button onClick={() => {demo.setFinalized(true); demo.setGuestStage('final'); demo.notify('Final plan published')}}>{demo.finalized ? 'Final plan published ✓' : 'Publish final plan'}</Button></div>
  </OrganizerShell>
}

function GuestShell({ children, signedIn = false }) {
  const demo = useDemo()
  const active = demo.guestStage === 'review' || demo.guestStage === 'update' || demo.guestStage === 'submitted' ? 'review' : demo.guestStage === 'final' ? 'final' : 'preferences'
  return <div className="guestShell"><FlowHeader role="Participant" steps={guestFlowSteps} active={active}>
    <div className="guestHeaderActions"><select aria-label="Demo participant state" value={demo.guestStage} onChange={e => demo.setGuestStage(e.target.value)}><option value="preferences">Preferences</option><option value="submitted">Waiting</option><option value="review">Plan review</option><option value="update">Plan update</option><option value="final">Final plan</option></select>{signedIn || demo.saved ? <Link className="btn btnSecondary" to="/">My Trips</Link> : <Button secondary onClick={() => demo.setSaved(true)}>Save to account</Button>}</div>
  </FlowHeader><main className="guestMain">{children}</main><footer className="guestFooter"><span>Private inputs are protected by your visibility settings.</span><Link to="/">Back to My Trips</Link></footer></div>
}

function GuestContent() {
  const demo = useDemo()
  return <>{demo.guestStage === 'preferences' && <Preferences/>}{demo.guestStage === 'submitted' && <Submitted/>}{demo.guestStage === 'review' && <GuestReview/>}{demo.guestStage === 'update' && <GuestUpdate/>}{demo.guestStage === 'final' && <GuestFinal/>}</>
}

function GuestPortal() {
  const demo = useDemo()
  if (demo.inviteJoined) return <GuestShell><GuestContent/></GuestShell>
  return <div className="guestShell"><header className="guestHeader"><Logo/><div className="guestTrip"><strong>{trip.name}</strong><span>{trip.dates}</span></div><div className="guestHeaderActions"><Link className="btn btnSecondary" to="/">My Trips</Link></div></header>
    <main className="inviteLanding"><section className="inviteCard"><Badge tone="purple">Invitation</Badge><h1>{trip.name}</h1><p>{trip.destination} · {trip.dates}</p><div className="inviteInfo"><div><strong>What happens next</strong><span>Review the trip basics, enter a nickname, then confirm how you want to join.</span></div><div><strong>Privacy</strong><span>Your private constraints are used for planning but are not shown to the organizer unless you choose that visibility.</span></div></div><label><span>Nickname</span><input value={demo.inviteName} onChange={e => demo.setInviteName(e.target.value)} placeholder="Mia" /></label><div className="formActions"><Button disabled={!demo.inviteName.trim()} onClick={() => { demo.setGuestStage('preferences'); demo.setInviteJoined(true); demo.setSaved(false); demo.notify('Guest membership created') }}>Continue as guest</Button><Button secondary disabled={!demo.inviteName.trim()} onClick={() => { demo.setGuestStage('preferences'); demo.setInviteJoined(true); demo.setSaved(true); demo.notify('Membership saved to account') }}>Log in and join</Button></div></section></main>
  </div>
}

function ParticipantPortal() {
  return <GuestShell signedIn><GuestContent/></GuestShell>
}

function Preferences({ organizerMode = false }) {
  const demo = useDemo(); const nav = useNavigate(); const [budget, setBudget] = useState(620); const [dateMode,setDateMode]=useState('attend'); const [availability,setAvailability]=useState(suggestedTripRange); const [alternative,setAlternative]=useState({ start: makeDate(7, 21), end: makeDate(7, 24) }); const [vibes,setVibes]=useState(['Food','Relaxed','Culture']); const [must,setMust]=useState('A private room and no activities before 9:00 AM.'); const [avoid,setAvoid]=useState('Very crowded nightlife venues.'); const [privacy,setPrivacy]=useState('ai'); const [quick,setQuick]=useState(false); const [question,setQuestion]=useState(null)
  const toggle=v=>setVibes(s=>s.includes(v)?s.filter(x=>x!==v):s.length<3?[...s,v]:s)
  const dateSummary = dateMode === 'unsure' ? 'Not sure yet' : dateMode === 'alternative' ? formatDateRange(alternative) : formatDateRange(availability)
  const submitPreferences = () => {
    if (organizerMode) {
      demo.setOrganizerPreferencesSubmitted(true)
      demo.notify('Organizer preferences submitted')
      nav(`/organizer/trip/${trip.id}/collect`)
      return
    }
    demo.setGuestStage('submitted')
  }
  return <div className={cx('guestNarrow', organizerMode && 'organizerPreferenceForm')}><div className="guestIntro"><Badge tone="purple">{organizerMode ? 'Organizer response' : 'No account needed'}</Badge><h1>{organizerMode ? 'Share your own preferences' : 'Share your trip preferences'}</h1><p>{organizerMode ? 'Your availability, budget, and must-haves count in the group plan just like every participant response.' : 'Five quick questions help the group plan around what actually works for you.'}</p><span className="timeEstimate">About 60 seconds</span></div>
    <section className="formCard"><div className="question"><span className="qNum">1</span><div><h2>When can you join?</h2><p>Organizer suggested {formatDateRange(suggestedTripRange)}. Choose your availability or propose another range.</p></div></div>
      <div className="dateModeTabs">
        <button type="button" className={dateMode === 'attend' ? 'selected' : ''} onClick={() => setDateMode('attend')}>I can attend</button>
        <button type="button" className={dateMode === 'alternative' ? 'selected' : ''} onClick={() => setDateMode('alternative')}>Suggest new dates</button>
        <button type="button" className={dateMode === 'unsure' ? 'selected' : ''} onClick={() => setDateMode('unsure')}>I'm not sure yet</button>
      </div>
      {dateMode === 'attend' && <DateRangePicker value={availability} onChange={setAvailability} min={suggestedTripRange.start} max={suggestedTripRange.end} suggestedRange={suggestedTripRange} caption="Choose the part of the organizer's dates that works for you." />}
      {dateMode === 'alternative' && <DateRangePicker value={alternative} onChange={setAlternative} suggestedRange={suggestedTripRange} caption="Your alternative will be shown as a date suggestion, not as confirmed availability." />}
      {dateMode === 'unsure' && <div className="uncertainDates"><strong>No dates selected yet</strong><span>The organizer will see that your dates need follow-up.</span></div>}
    </section>
    <section className="formCard"><div className="question"><span className="qNum">2</span><div><h2>What total budget feels comfortable?</h2><p>Per person for the full trip, excluding flights.</p></div></div><div className="budgetValue">Up to <strong>${budget}</strong></div><input type="range" min="350" max="900" step="10" value={budget} onChange={e=>setBudget(e.target.value)}/><div className="rangeLabels"><span>$350</span><span>$900+</span></div></section>
    <section className="formCard"><div className="question"><span className="qNum">3</span><div><h2>Anything the trip must accommodate?</h2><p>Examples: accessibility, dietary needs, a firm budget limit, or a required time.</p></div></div><textarea rows="3" value={must} onChange={e=>setMust(e.target.value)}/><Visibility value={privacy} onChange={setPrivacy}/></section>
    <section className="formCard"><div className="question"><span className="qNum">4</span><div><h2>What should this trip feel like?</h2><p>Choose up to three.</p></div></div><div className="chipGrid">{['Relaxed','Food','Culture','Nature','Nightlife','Shopping','Adventure','Photography'].map(v=><button className={vibes.includes(v)?'selected':''} onClick={()=>toggle(v)} key={v}>{v}</button>)}</div></section>
    <section className="formCard"><div className="question"><span className="qNum">5</span><div><h2>Anything you definitely want to avoid?</h2><p>Optional · one sentence is enough.</p></div></div><input value={avoid} onChange={e=>setAvoid(e.target.value)}/></section>
    {!quick && <section className="quickCheckOffer"><span className="aiOrb">✦</span><div><h2>Check my answers</h2><p>Optional. TripSync can structure your free text, spot ambiguity, and ask up to three important questions.</p></div><Button secondary onClick={()=>setQuick(true)}>Check answers</Button></section>}
    {quick && <section className="quickCheck"><div className="quickTitle"><span className="aiOrb">✦</span><div><span className="eyebrow">Preference check</span><h2>One detail needs confirmation</h2></div><Badge tone="purple">1 of 1</Badge></div><p>You wrote "private room." How important is this?</p><div className="optionStack"><button className={question==='must'?'selected':''} onClick={()=>setQuestion('must')}><strong>Must be met</strong><span>I cannot join under a shared-room arrangement.</span></button><button className={question==='flexible'?'selected':''} onClick={()=>setQuestion('flexible')}><strong>Prefer, but flexible</strong><span>I would consider another arrangement.</span></button></div><div className="aiSummary"><strong>Structured summary</strong><span>Budget · Up to ${budget}</span><span>Dates · {dateSummary}</span><span>Vibe · {vibes.join(' · ')}</span><span>Protected condition · Private room · {question==='must'?'Must be met':'Needs confirmation'}</span></div></section>}
    <div className="submitBar"><div><strong>{organizerMode ? 'Your organizer response will be included in the plan.' : 'Your answers are saved automatically.'}</strong><span>{organizerMode ? 'After submitting, you return to the collect dashboard.' : 'You can return to this link before the deadline.'}</span></div><Button onClick={submitPreferences}>{organizerMode ? 'Submit organizer preferences →' : 'Confirm and submit →'}</Button></div>
  </div>
}

function Visibility({ value, onChange }) { return <div className="visibility"><span>Who can see this?</span>{[['ai','Planning only'],['organizer','Organizer can view'],['group','Everyone']].map(([v,l])=><button key={v} onClick={()=>onChange(v)} className={value===v?'selected':''}>{v==='ai'?'🔒':'○'} {l}</button>)}</div> }

function Submitted() { const demo=useDemo(); const reviewMode = demo.reviewed; return <div className="centerState"><div className="successMark">✓</div><Badge tone="green">{reviewMode ? 'Review submitted' : 'Preferences submitted'}</Badge><h1>{reviewMode ? 'Thanks. Your review was saved.' : 'You’re all set.'}</h1><p>{reviewMode ? 'The organizer can now resolve any requested changes before the trip is finalized.' : 'Your responses are included in the current planning window. Come back to this same trip when the plan is ready.'}</p><div className="statusCard"><div><strong>{reviewMode ? (demo.selectedSection ? '1 request' : 'Accepted') : '4 of 6'}</strong><span>{reviewMode ? (demo.selectedSection ? 'needs organizer review' : 'plan works for you') : 'people submitted'}</span></div><div className="miniProgress"><i style={{width: reviewMode ? '80%' : '67%'}}/></div><small>{reviewMode ? 'Review status updated' : trip.deadline}</small></div><Button onClick={()=>demo.setGuestStage(reviewMode ? 'update' : 'review')}>{reviewMode ? 'View plan update →' : 'Preview the plan review →'}</Button></div> }

function GuestReview() {
  const demo = useDemo()
  const acceptPlan = () => { demo.setSelectedSection(null); demo.setNote(''); demo.setReviewed(true); demo.setGuestStage('submitted'); demo.notify('Plan accepted') }
  return <div className="guestWide"><div className="guestIntro reviewIntro"><Badge tone="blue">Plan ready for review</Badge><h1>Review the Chicago itinerary</h1><p>You see the same day-by-day plan as the organizer. You only need to comment when something does not work or needs a change.</p><span className="timeEstimate">Silent means acceptable</span></div><ItineraryPlanExperience participantMode /><div className="reviewSubmit"><div><strong>Everything acceptable?</strong><span>You can accept the plan without reacting to each item. Anonymous comments stay attached to their itinerary item.</span></div><Button onClick={acceptPlan}>Accept plan</Button></div></div>
}

function CommentComposer
() { const demo=useDemo(); return <section className="commentComposer" id="commentComposer"><div className="panelHeader"><div><span className="eyebrow">Note on</span><h2>{demo.selectedSection.title}</h2></div><button className="closeBtn" onClick={()=>demo.setSelectedSection(null)}>×</button></div><label>What should the group know?</label><textarea rows="3" value={demo.note} onChange={e=>demo.setNote(e.target.value)} placeholder="One sentence is enough..."/><label>How important is this?</label><div className="optionStack horizontal"><button className={demo.noteType==='suggestion'?'selected':''} onClick={()=>demo.setNoteType('suggestion')}><strong>Suggestion</strong><span>I can still accept the plan.</span></button><button className={demo.noteType==='required'?'selected':''} onClick={()=>demo.setNoteType('required')}><strong>Required change</strong><span>This section does not work for me.</span></button></div><Visibility value={demo.visibility} onChange={demo.setVisibility}/></section> }

function GuestUpdate() { const demo=useDemo(); return <div className="guestNarrow"><div className="guestIntro"><Badge tone="orange">One change needs your review</Badge><h1>Day 2 starts later</h1><p>Only this affected section needs your confirmation. Your acceptance for the rest of the plan stays in place.</p></div><section className="changeCard"><div className="compare"><div><span>Before</span><strong>8:00 AM</strong><p>Architecture cruise</p></div><div className="arrow">→</div><div className="after"><span>Now</span><strong>10:00 AM</strong><p>Architecture cruise</p></div></div><div className="aiBox"><span>✦</span><div><strong>Why it changed</strong><p>The later start addresses participant feedback without changing the budget. Lunch moves 45 minutes later.</p></div></div></section><div className="submitBar"><div><strong>Everything else is unchanged.</strong><span>Your previous acceptance is retained.</span></div><Button onClick={()=>demo.setGuestStage('final')}>Accept update</Button></div></div> }

function GuestFinal() {
  const demo = useDemo()
  return <div className="guestWide"><div className="finalBanner"><div className="successMark smallMark">✓</div><div><Badge tone="green">Ready to confirm</Badge><h1>{trip.name}</h1><p>{trip.dates} · {trip.destination}</p><span className="finalHint">This plan is not locked yet. You can return to review before confirming.</span></div><div className="finalBannerActions"><Button secondary onClick={() => { demo.setGuestStage('review'); demo.notify('Returned to plan review') }}>Back to review</Button><Button onClick={() => demo.notify('Trip confirmed')}>Confirm trip</Button></div></div><div className="planLayout guestPlan"><main>{planSections.map(s=><PlanCard key={s.id} section={s}/>)}</main><aside className="summaryRail"><h3>Approval summary</h3><div className="healthItem"><span>Accepted</span><strong>4 of 5</strong></div><div className="healthItem"><span>Approval</span><strong>80%</strong></div><div className="healthItem"><span>Must-haves</span><strong className="greenText">All satisfied</strong></div><hr/><p>This plan represents submitted responses. It remains editable until the participant confirms the trip.</p></aside></div></div>
}

export default function FinalApp() {
  return <DemoProvider><Routes><Route path="/" element={<Home/>}/><Route path="/organizer" element={<OrganizerTrips/>}/><Route path="/organizer/archived" element={<OrganizerTrips archived/>}/><Route path="/organizer/create" element={<CreateTripPage/>}/><Route path="/organizer/account" element={<AccountPage/>}/><Route path="/organizer/settings" element={<SettingsPage/>}/><Route path="/organizer/trip/:tripId/preferences" element={<OrganizerPreferencesPage/>}/><Route path="/organizer/trip/:tripId/collect" element={<CollectPage/>}/><Route path="/organizer/trip/:tripId/insights" element={<InsightsPage/>}/><Route path="/organizer/trip/:tripId/plan" element={<PlanPage/>}/><Route path="/organizer/trip/:tripId/review" element={<ReviewOrganizerPage/>}/><Route path="/organizer/trip/:tripId/final" element={<FinalOrganizerPage/>}/><Route path="/participant/trip/:tripId" element={<ParticipantPortal/>}/><Route path="/t/:slug" element={<GuestPortal/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></DemoProvider>
}
