import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTripApp } from '../TripAppState.jsx'
import { trip } from '../tripContent.js'
import TripMap from '../TripMap.jsx'
import { serializeWorkspaceRoute } from '../../../../shared/trip-navigation-route/index.js'
import { useAssistantChangeRequestFlow } from './useAssistantChangeRequestFlow.js'
import { usePlanInteractionRuntime } from './usePlanInteractionRuntime.js'

const visibleStatus = status => ['Booked', 'Updated'].includes(status) ? status : ''
const statusTone = status => status === 'Booked' ? 'purple' : status === 'Updated' ? 'green' : 'blue'
const cx = (...classes) => classes.filter(Boolean).join(' ')
const tripHref = (tripId, section) => serializeWorkspaceRoute({ kind: 'trip', tripId, section })
const tripPlanHref = (tripId, focusItemId) => {
  const href = tripHref(tripId, 'plan')
  return focusItemId ? `${href}?focus=${encodeURIComponent(focusItemId)}` : href
}

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

const fieldLabels = {
  title: 'Title',
  place: 'Place',
  start_hour: 'Time',
  day_date: 'Date',
  duration_min: 'Duration',
  price_per_person: 'Price',
  settledness: 'Status',
}

const formatPatchValue = (key, value) => {
  if (key === 'start_hour') return formatPlanHour(value)
  if (key === 'day_date') return formatChangeDay(value) || value
  if (key === 'duration_min') return `${value} min`
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const formatChangeSummary = change => {
  const entries = Object.entries(change.patch || {})
    .filter(([key]) => !['lat', 'lng', 'photo_url'].includes(key))
  if (!entries.length) return 'Recorded the decision without changing visible fields.'
  return entries
    .map(([key, value]) => `${fieldLabels[key] || key}: ${formatPatchValue(key, value)}`)
    .join(' · ')
}

const formatChangeTime = value => {
  if (!value) return ''
  return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const originLabel = origin => ({
  notice: 'Direct change',
  round: 'Vote result',
  reopen_round: 'Reopened vote',
  confirm: 'Confirmed change',
  booking: 'Booking status',
  organizer_resolution: 'Organizer resolution',
}[origin] || origin || 'Change')

const decisionPresentation = {
  notice: {
    summary: 'No conflicts found. This change can apply now.',
    status: 'NOTICE · No approval needed',
    action: 'Apply change',
  },
  round: {
    summary: 'There is another preference affecting this change. A group decision is needed.',
    status: 'GROUP DECISION · Group input needed',
    action: 'Start group decision',
  },
  reopen_round: {
    summary: 'This settled choice needs group input before it can change.',
    status: 'GROUP DECISION · Group input needed',
    action: 'Start group decision',
  },
  confirm: {
    summary: 'This change affects a confirmed booking or required constraint. Approval is needed before the plan changes.',
    status: 'CONFIRMATION NEEDED · Affected member approval required',
    action: 'Request approval',
  },
}

function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Button({ children, secondary, ghost, className, ...props }) {
  return <button className={cx('btn', secondary && 'btnSecondary', ghost && 'btnGhost', className)} {...props}>{children}</button>
}

function usePlanCurrentTrip() {
  const { tripId } = useParams()
  const app = useTripApp()
  return app.trips.find(item => item.id === tripId) || app.trip || trip || null
}

function ActivityPhoto({ item }) {
  const [failed, setFailed] = useState(false)
  if (!item.photoUrl || failed) return <div className="activityPhoto activityPhotoFallback"><span>Photo</span></div>
  return <div className="activityPhoto"><img src={item.photoUrl} alt="" loading="lazy" onError={() => setFailed(true)}/></div>
}

function NewTripPlan({ currentTrip }) {
  const app = useTripApp()
  const [progress, setProgress] = useState(null)
  const [generateError, setGenerateError] = useState('')
  const [blockedReason, setBlockedReason] = useState('')
  const isOrganizer = app.currentUser.role === 'organizer'
  const onboarding = currentTrip.onboarding || {}
  const organizerPreferenceStatus = currentTrip.organizerPreference?.status || onboarding.organizer_preference?.status

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
  const meSubmitted = Boolean(progress?.meSubmitted) || (isOrganizer && organizerPreferenceStatus === 'complete')
  const canGenerate = isOrganizer && meSubmitted && !app.loading.action
  const progressText = `${submitted} of ${total} people have shared what they need.`
  const visibleBlockedReason = blockedReason || app.planBlockedReason || ''
  const generationBlocked = Boolean(visibleBlockedReason)
  const budgetBlocked = visibleBlockedReason.toLowerCase().includes('budget')
  const dateBlocked = visibleBlockedReason.toLowerCase().includes('date')
  const blockedHelp = budgetBlocked
    ? 'Raise the maximum budget, remove the budget ceiling, or choose cheaper places.'
    : dateBlocked
      ? 'Set a valid trip date range, then try generating again.'
      : 'Edit preferences, remove or loosen required constraints, or shorten the trip window.'
  const headline = generationBlocked
    ? 'The requirements blocked this itinerary'
    : isOrganizer
      ? meSubmitted ? 'Ready to generate' : 'Share your preferences first'
      : meSubmitted ? 'You are ready' : 'Share your preferences first'
  const body = generationBlocked
    ? 'Cadensy could not build a valid plan from the current requirements.'
    : isOrganizer
      ? meSubmitted
        ? missing > 0
          ? `${progressText} You can generate now, but missing hard requirements will not be checked.`
          : 'Everyone has shared preferences. You can generate the first itinerary.'
        : 'Your own requirements need to be included before Cadensy creates the group plan.'
      : meSubmitted
        ? 'Your preferences are saved. The organizer will generate the itinerary when the group is ready.'
        : 'Add your preferences so the organizer can generate a plan that checks your requirements.'
  const statusLabel = generationBlocked ? 'Blocked' : missing === 0 ? 'Ready' : `${missing} waiting`
  const primaryAction = isOrganizer
    ? meSubmitted
      ? { kind: 'generate', label: app.loading.action ? 'Generating...' : 'Generate itinerary' }
      : { kind: 'preferences', label: 'Fill my preferences' }
    : { kind: 'preferences', label: meSubmitted ? 'Review preferences' : 'Fill my preferences' }

  const generate = async () => {
    setGenerateError('')
    setBlockedReason('')
    try {
      const result = await app.generatePlan()
      if (result.status === 'blocked') {
        setBlockedReason(result.blocked_reason || 'The required budget limit is too low for the available places.')
        return
      }
      app.notify('Itinerary generated')
    } catch (err) {
      if (err.code === 'organizer_preference_missing' || err.status === 422) setGenerateError('Fill your preferences before generating the first itinerary.')
      else if (err.status === 409) setGenerateError('An itinerary already exists.')
      else setGenerateError('Could not generate the itinerary. Try again in a moment.')
    }
  }

  return <>
    <div className="pageHeading setupPageHeading compactSetupHeading">
      <div>
        <span className="eyebrow">Current Plan</span>
        <h1>No itinerary yet</h1>
      </div>
    </div>
    <section className="setupCompactPanel">
      <div className="setupCompactTop">
        <div>
          <Badge tone={generationBlocked ? 'orange' : missing === 0 ? 'green' : 'blue'}>{isOrganizer ? 'Organizer step' : 'Waiting for organizer'}</Badge>
          <h2>{headline}</h2>
          <p>{submitted} of {total} preferences in</p>
        </div>
        <span className={cx('setupCompactCount', missing === 0 && !generationBlocked && 'done', generationBlocked && 'blocked')}>{statusLabel}</span>
      </div>

      <p className="compactLead">{body}</p>

      <div className="compactActionRow">
        {primaryAction.kind === 'generate'
          ? <Button disabled={!canGenerate} onClick={generate}>{primaryAction.label}</Button>
          : <Link className="btn" to={tripHref(currentTrip.id, 'preferences')}>{primaryAction.label}</Link>}
        {primaryAction.kind === 'generate' && <Link className="btn btnSecondary" to={tripHref(currentTrip.id, 'preferences')}>Edit preferences</Link>}
        {isOrganizer && <Link className="btn btnSecondary" to={tripHref(currentTrip.id, 'invite')}>Invite people</Link>}
        {isOrganizer && meSubmitted && <Link className="btn btnSecondary" to={tripHref(currentTrip.id, 'members')}>Check members</Link>}
      </div>

      {isOrganizer && !meSubmitted && <p className="compactHint">Only the organizer can generate the first itinerary, but your preferences must be in first.</p>}
      {(visibleBlockedReason || generateError) && <div className="setupError compactError">
        {visibleBlockedReason && <><strong>{visibleBlockedReason}</strong><p>{blockedHelp}</p></>}
        {generateError && <p className="formError">{generateError}</p>}
      </div>}
    </section>
  </>
}

function PlanDecisionRoundCard({ round, compact, onCommand }) {
  const app = useTripApp()
  const currentTrip = usePlanCurrentTrip()
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
          : isReopen ? 'No response counts as keeping the current decision, so a change needs a clear majority.' : 'Vote on the option, not the person. Ideas stay anonymous while the group chooses what happens to this block.'}</p>
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
      <span>Anonymous — cards are choices, not members.</span>
      <div className="roundFooterActions">
        {isOrganizer && <button type="button" className="roundDiscuss" disabled={app.loading.action} onClick={extend}>{app.loading.action ? 'Extending...' : 'Extend'}</button>}
        <button type="button" className="roundDiscuss" onClick={() => onCommand?.({ type: 'navigate', to: tripHref(currentTrip.id, 'conflict') })}>None of these work — discuss instead</button>
      </div>
    </div>}
    {closed && <div className="roundFooter">
      <span>The round has been settled.</span>
      <Link className="btn btnSecondary" to={planTarget}>View result in plan →</Link>
    </div>}
  </article>
}

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

function PlanChatBubble({ from, children }) {
  const app = useTripApp()
  const currentUser = app.currentUser
  const isUser = from === 'you'
  return <div className={cx('chatBubbleRow', isUser && 'mine')}>
    {!isUser && <span className="chatAvatar tripSync">C</span>}
    <div className={cx('drawerMessage', isUser ? 'mine' : 'assistant')}><strong>{isUser ? 'You' : 'Cadensy'}</strong><p>{children}</p></div>
    {isUser && <span className="chatAvatar user">{currentUser.initials}</span>}
  </div>
}

function ChangeConfirmCard({ message, proposedChange, currentItem, showRecognizedItem, onApply, onDismiss }) {
  const verdict = proposedChange.verdict
  const patch = proposedChange.patch || {}
  const before = {
    title: currentItem?.title || proposedChange.item_title,
    place: currentItem?.place || '',
    time: currentItem?.time || formatPlanHour(currentItem?.startHour),
    day: formatChangeDay(currentItem?.dayDate),
  }
  const after = {
    title: patch.title || before.title,
    place: patch.place || before.place,
    time: patch.start_hour !== undefined ? formatPlanHour(patch.start_hour) : before.time,
    day: formatChangeDay(patch.day_date || currentItem?.dayDate),
  }
  const presentation = decisionPresentation[verdict.path] || decisionPresentation.notice
  const changedField = patch.start_hour !== undefined
    ? { label: 'Time', before: before.time, after: after.time }
    : patch.day_date
      ? { label: 'Day', before: before.day || 'Current day', after: after.day || 'Proposed day' }
      : patch.title
        ? { label: 'Activity', before: before.title, after: after.title }
        : patch.place
          ? { label: 'Place', before: before.place || before.title, after: after.place || after.title }
          : { label: 'Change', before: before.time, after: after.time }

  return <div className={cx('changeConfirmCard', message.applied && 'done')}>
    {showRecognizedItem && <div className="recognizedItem"><span>Cadensy matched this to</span><strong>{proposedChange.item_title}</strong></div>}
    <div className="changeConfirmHead">
      <div><span>{changedField.label} change</span><h3>{proposedChange.item_title}</h3>{before.place && <p>{before.place}</p>}</div>
      {message.applied && <Badge tone="green">Done</Badge>}
    </div>
    <div className="changeCompare assistantChangeCompare">
      <div><small>Current</small><strong>{changedField.before}</strong></div>
      <b>→</b>
      <div className="new"><small>Proposed</small><strong>{changedField.after}</strong></div>
    </div>
    <div className={cx('decisionStatus', `decisionStatus--${verdict.path}`)}>{presentation.status}</div>
    {message.applyError && <p className="assistantError">{message.applyError}</p>}
    <div className="changeDecisionActions">
      <button className="changePrimaryAction" onClick={onApply} disabled={message.applied || message.applying}>{message.applied ? 'Applied' : message.applying ? 'Applying...' : presentation.action}</button>
      {!message.applied && <button className="changeCancelAction" onClick={onDismiss}>Cancel</button>}
    </div>
  </div>
}

function AssistantDrawer({ item, mode, onClose, onCommand, onResolvedOutcome, inline = false }) {
  const actionLabels = {
    global: 'Ask Cadensy',
    ask: 'Ask Cadensy',
    editTime: 'Edit time',
    moveDay: 'Move to another day',
    replacePlace: 'Replace place',
    removePlan: 'Remove from plan',
    details: 'View details',
  }
  const {
    view,
    actions,
  } = useAssistantChangeRequestFlow({
    item,
    mode,
    onCommand,
    onResolvedOutcome,
  })

  const drawer = <aside className={cx('assistantDrawer', inline && 'inlineAssistant')} onClick={event => event.stopPropagation()}>
      <header><div><span className="eyebrow">{actionLabels[mode]}</span><h2>{item.title}</h2><p>{item.place} · {item.time}</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="drawerThread" ref={view.threadRef}>
        <div className="assistantBubbleRail"><i/><i/><i/></div>
        <PlanChatBubble from="tripSync">{mode === 'global' ? 'Ask me about the itinerary, or tell me what you want to adjust. If I can identify the item, I will show the change before anything is submitted.' : 'Ask me about this item, or tell me a change in your own words. I will check it first and show exactly what would be submitted.'}</PlanChatBubble>
        {view.messages.map(message => <div key={message.id}>
          <PlanChatBubble from={message.from}>{message.proposedChange ? (decisionPresentation[message.proposedChange.verdict?.path] || decisionPresentation.notice).summary : message.text}</PlanChatBubble>
          {message.proposedChange && <ChangeConfirmCard
            message={message}
            proposedChange={message.proposedChange}
            currentItem={view.itemById[message.proposedChange.item_id] || (item.id === message.proposedChange.item_id ? item : null)}
            showRecognizedItem={mode === 'global'}
            onApply={() => actions.applyProposal(message, message.proposedChange)}
            onDismiss={() => actions.dismissProposal(message.id)}
          />}
        </div>)}
        {mode === 'details' && <div className="detailSheet"><dl><div><dt>Time</dt><dd>{item.time}</dd></div><div><dt>Place</dt><dd>{item.place}</dd></div><div><dt>Status</dt><dd>{item.status || '—'}</dd></div><div><dt>Note</dt><dd>{item.note}</dd></div></dl></div>}
        {view.pendingRedirect && <p className="redirectHint">{view.pendingRedirect}</p>}
      </div>
      <div className="drawerComposer"><input ref={view.inputRef} value={view.draft} onChange={event => actions.updateDraft(event.target.value)} onKeyDown={event => event.key === 'Enter' && actions.sendMessage()} placeholder={view.placeholder}/><button aria-label="Send message" disabled={view.sending || !view.draft.trim()} onClick={actions.sendMessage}>{view.sending ? '...' : '↑'}</button></div>
    </aside>
  if (inline) return drawer
  return <div className="drawerOverlay" onClick={onClose}>{drawer}</div>
}

export default function PlanFeature({ onCommand }) {
  const currentTrip = usePlanCurrentTrip()
  if (!currentTrip) {
    return <div className="emptyState quietEmptyState">
      <span></span>
      <h2>No trip loaded</h2>
      <p>This plan needs a real trip from your account or an invite session.</p>
    </div>
  }
  return <LoadedPlanFeature currentTrip={currentTrip} onCommand={onCommand}/>
}

function LoadedPlanFeature({ currentTrip, onCommand }) {
  const {
    view,
    actions,
  } = usePlanInteractionRuntime({ currentTrip })
  const app = view.app

  if (!app.loading.initial && view.days.length === 0) return <NewTripPlan currentTrip={currentTrip}/>

  return <div className={cx('planSplit', !view.drawerItem && 'withMap', view.drawerItem && 'withAssistant')}>
    <section className="planMainPane">
      <div className="pageHeading planHeading"><div><span className="eyebrow">Current Plan</span><h1>Your shared itinerary</h1></div><div className="planHeadingActions"><Badge tone="blue">Live plan</Badge><Link className="btn btnSecondary" to={tripHref(currentTrip.id, 'preferences')}>Edit preferences</Link><Button secondary className="askCadensyBtn" onClick={() => actions.openDrawer({ title: 'Full itinerary', place: currentTrip.destination, time: currentTrip.dates, note: 'Ask about the whole trip plan.' }, 'global')}>✦ Ask Cadensy</Button></div></div>
      {app.loading.initial && <div className="planNotice"><span>…</span><div><strong>Loading trip data</strong><p>Fetching the current plan from the backend.</p></div></div>}
      {app.error && <div className="planNotice"><span>!</span><div><strong>Backend request failed</strong><p>{app.error}</p></div><button type="button" onClick={app.refreshAll}>Retry</button></div>}
      {app.conflictCreated && !app.decisionResolved && <Link className="planNotice" to={tripHref(currentTrip.id, 'updates')}><span>!</span><div><strong>Proposed change waiting for confirmation</strong><p>A hard constraint is involved. The current plan remains active until the affected members accept.</p></div><b>Review →</b></Link>}
      {app.decisionResolved && <div className="successNotice"><span>✓</span><div><strong>The plan was updated</strong><p>Every affected member confirmed. Bookings elsewhere in the plan are unchanged.</p></div></div>}
      <div className="accordionPlan">
        {view.days.map(day => {
          const open = view.openDays.includes(day.id)
          return <section className={cx('accordionDay', open && 'open')} key={day.id}>
            <button className="accordionHead" onClick={() => actions.toggleDay(day.id)} aria-expanded={open}>
              <span className="dayNumber">{day.label}</span><div><small>{day.date}</small><h2>{day.title}</h2></div><p>{day.summary}</p><i>{open ? '−' : '+'}</i>
            </button>
            <div className="accordionBody"><div className="accordionInner">
              <div className="dayRouteLine">
                <span>{day.items.length} stops</span>
                <strong>{day.items.map(item => item.place).join(' → ')}</strong>
                <button type="button" onClick={() => actions.showDayOnMap(day.id)}>Show on map</button>
              </div>
              <div className="activityBlocks">{day.items.map((item, index) => <div className="activityBlockGroup" key={item.id}>
                <article id={`trip-item-${item.id}`} className={cx('activityBlock', view.selectedTripItemId === item.id && 'selected', view.highlightedItemId === item.id && 'updatedFlash')} onClick={() => actions.selectPlanItem(item.id)}>
                  <button type="button" className={cx('activityIndex', view.historyOpen === item.id && 'open')} aria-label="Show change history" onClick={event => { event.stopPropagation(); actions.toggleHistory(item.id) }}><b>{index + 1}</b></button>
                  <ActivityPhoto item={item}/>
                  <div className="activityMain"><div className="activityTitle"><div><small>{day.date}</small><h3>{item.title}</h3></div>{visibleStatus(item.status) && <Badge tone={statusTone(item.status)}>{visibleStatus(item.status)}</Badge>}</div><p className="activityMeta">⌖ {item.place} <span>•</span> ◷ {item.time}</p><p>{item.note}</p>{item.locked && <small className="lockedNote">🔒 Existing reservation</small>}</div>
                  <div className="activityActions"><button className="itemIconAction" title="Discuss" onClick={() => actions.toggleCommentComposer(item.id)}>💬{(view.comments[item.id] || []).length > 0 && <i>{view.comments[item.id].length}</i>}</button><button className="itemIconAction" title="Ask Cadensy" onClick={() => actions.openDrawer(item, 'ask', day)}>✦</button><div className="moreWrap"><button className="moreBtn" onClick={() => actions.toggleMenu(item.id)}>•••</button>{view.menuOpen === item.id && <div className="actionMenu"><button onClick={() => actions.openDrawer(item, 'editTime', day)}>Edit time</button><button onClick={() => actions.openDrawer(item, 'moveDay', day)}>Move to another day</button><button onClick={() => actions.openDrawer(item, 'replacePlace', day)}>Replace place</button><button disabled={app.loading.action} onClick={() => actions.toggleBooked(item)}>{item.settledness === 'booked' ? 'Remove booked status' : 'Mark as booked'}</button><button onClick={() => actions.openDrawer(item, 'removePlan', day)}>Remove from plan</button><button onClick={() => actions.openDrawer(item, 'details', day)}>View details</button></div>}</div></div>
                  {(view.comments[item.id] || []).length > 0 && <div className="publicThread">{view.comments[item.id].map((comment, i) => <div key={comment.id || `${item.id}-${i}`}><span>{comment.initials || comment.name.slice(0,2).toUpperCase()}</span><p><strong>{comment.name}</strong>{comment.text}</p></div>)}</div>}
                  {view.historyOpen === item.id && (view.changeHistory[item.id] || []).length > 0 && <div className="itemHistoryPanel">
                    <div className="itemHistoryHead"><strong>Change history</strong><span>{(view.changeHistory[item.id] || []).length} records</span></div>
                    <ol>{view.changeHistory[item.id].map(change => <li key={change.id}>
                      <span>{originLabel(change.origin)}</span>
                      <p>{formatChangeSummary(change)}</p>
                      <small>{formatChangeTime(change.applied_at)}{change.reason ? ` · ${change.reason}` : ''}</small>
                    </li>)}</ol>
                  </div>}
                  {view.commenting === item.id && <div className="publicComposer"><label>Group note</label><textarea rows="2" value={view.commentDraft} onChange={e => actions.updateCommentDraft(e.target.value)} placeholder="Whole group can see this note." />{view.commentError && <p className="formError">{view.commentError}</p>}<div><button onClick={actions.cancelCommentComposer}>Cancel</button><Button disabled={app.loading.action || !view.commentDraft.trim()} onClick={() => actions.submitComment(item.id)}>{app.loading.action ? 'Posting...' : 'Post note'}</Button></div></div>}
                </article>
                {app.activeRounds?.filter(round => round.itemId === item.id || round.itemTitle === item.title).map(round => <PlanDecisionRoundCard key={round.id} round={round} compact onCommand={onCommand}/>)}
                {index < day.items.length - 1 && <div className="routeSegment">
                  <span>Between stops</span>
                  <strong>{formatStraightLineDistance(item, day.items[index + 1])}</strong>
                  <button type="button" onClick={() => actions.showDayOnMap(day.id)}>Map</button>
                </div>}
              </div>)}</div>
            </div></div>
          </section>
        })}
      </div>
    </section>
    {!view.drawerItem && <aside className="tripMapRail" aria-label="Trip route overview">
      <div className="tripMapCard">
        <div className="mapDayTabs">
          <button type="button" className={view.railDay === 'all' ? 'active' : ''} onClick={actions.showAllOnMap}>All</button>
          {view.days.map(day => <button type="button" key={day.id} className={view.railDay === day.id ? 'active' : ''} onClick={() => actions.showDayOnMap(day.id)}>{day.label.split(' · ')[0]}</button>)}
        </div>
        <TripMap key={view.railDay} days={view.railDays} destination={currentTrip.destination} selectedItemId={view.selectedTripItemId} onSelectItem={actions.handleSelectTripItem} variant="real" markerMode={view.railDay === 'all' ? 'day' : 'stop'}/>
        <div className="tripMapSummary">
          <strong>{view.railDay === 'all' ? `${view.days.reduce((n, d) => n + d.items.length, 0)} stops across ${view.days.length} days` : `${view.railDays[0]?.items.length || 0} stops · ${view.railDays[0]?.date || ''}`}</strong>
          <p>Tap a pin to jump to that stop.</p>
        </div>
      </div>
    </aside>}
    {view.drawerItem && <AssistantDrawer item={view.drawerItem} mode={view.drawerMode} onClose={actions.closeDrawer} onCommand={onCommand} onResolvedOutcome={resolution => {
      if (resolution.kind === 'focus-item') {
        actions.closeDrawer()
        actions.focusPlanItem(resolution.itemId)
      } else if (resolution.kind === 'focus-round') {
        actions.closeDrawer()
        actions.focusPlanItem(resolution.itemId, 'round')
      }
    }} inline/>}
  </div>
}
