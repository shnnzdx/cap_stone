import { createContext, useContext, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { feedback, insights, members, planSections, trip } from './finalData'

const DemoContext = createContext(null)
const useDemo = () => useContext(DemoContext)

function DemoProvider({ children }) {
  const [guestStage, setGuestStage] = useState('preferences')
  const [reviewed, setReviewed] = useState(false)
  const [selectedSection, setSelectedSection] = useState(null)
  const [note, setNote] = useState('')
  const [noteType, setNoteType] = useState('suggestion')
  const [visibility, setVisibility] = useState('organizer')
  const [satisfaction, setSatisfaction] = useState(4)
  const [saved, setSaved] = useState(false)
  const [planUpdated, setPlanUpdated] = useState(false)
  const [finalized, setFinalized] = useState(false)
  const value = useMemo(() => ({ guestStage, setGuestStage, reviewed, setReviewed, selectedSection, setSelectedSection, note, setNote, noteType, setNoteType, visibility, setVisibility, satisfaction, setSatisfaction, saved, setSaved, planUpdated, setPlanUpdated, finalized, setFinalized }), [guestStage, reviewed, selectedSection, note, noteType, visibility, satisfaction, saved, planUpdated, finalized])
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>
}

const cx = (...xs) => xs.filter(Boolean).join(' ')

function Button({ children, secondary, ghost, className, ...props }) {
  return <button className={cx('btn', secondary && 'btnSecondary', ghost && 'btnGhost', className)} {...props}>{children}</button>
}

function Badge({ children, tone = 'neutral' }) { return <span className={`badge badge-${tone}`}>{children}</span> }

function Logo() { return <Link to="/" className="logo"><span className="logoMark">T</span><span>TripSync</span></Link> }

function Home() {
  return <main className="landing">
    <div className="landingNav"><Logo /><span className="landingTag">AI-assisted group trip decisions</span></div>
    <section className="hero">
      <Badge tone="purple">Final workflow prototype</Badge>
      <h1>Turn everyone’s real constraints into one plan the group can support.</h1>
      <p>TripSync calculates shared dates and budgets, protects private must-haves, and turns feedback into a clear, explainable trip plan.</p>
      <div className="heroActions">
        <Link className="btn" to="/organizer">Open organizer workspace</Link>
        <Link className="btn btnSecondary" to="/t/chicago-birthday">Open participant link</Link>
      </div>
    </section>
    <section className="roleGrid">
      <article><span className="roleNumber">01</span><h2>Organizer</h2><p>Creates the trip, tracks response coverage, reviews anonymous insights, and publishes group-approved plans.</p></article>
      <article><span className="roleNumber">02</span><h2>Participant</h2><p>No account required. Shares preferences, reviews the full plan, accepts it, or comments on one specific section.</p></article>
      <article><span className="roleNumber">03</span><h2>AI + rules</h2><p>AI explains and synthesizes. Deterministic rules calculate dates, budgets, permissions, and approval readiness.</p></article>
    </section>
  </main>
}

const organizerNav = [
  ['collect', 'Collect'], ['insights', 'Insights'], ['plan', 'Plan'], ['review', 'Review'], ['final', 'Final']
]

function OrganizerShell({ children }) {
  const location = useLocation()
  return <div className="appShell">
    <aside className="sidebar">
      <Logo />
      <nav className="sideNav">
        <Link className="active" to="/organizer">▣ <span>My Trips</span></Link>
        <Link to="/organizer">□ <span>Archived</span></Link>
        <Link to="/organizer">＋ <span>Create Trip</span></Link>
      </nav>
      <nav className="sideNav sideBottom">
        <Link to="/organizer">⚙ <span>Settings</span></Link>
        <Link to="/organizer">○ <span>Account</span></Link>
        <Link to="/">↗ <span>Switch demo role</span></Link>
      </nav>
    </aside>
    <div className="appMain">
      <header className="organizerTop">
        <div><span className="eyebrow">Organizer workspace</span><strong>Emma Carter</strong></div>
        <div className="avatar">EC</div>
      </header>
      {location.pathname.includes('/trip/') && <div className="tripHeader">
        <div><Link to="/organizer" className="backLink">My Trips</Link><span className="slash">/</span><strong>{trip.name}</strong></div>
        <div className="tripNav">{organizerNav.map(([id, label], index) => <Link key={id} className={location.pathname.endsWith(id) ? 'active' : ''} to={`/organizer/trip/${trip.id}/${id}`}><span>{index + 1}</span>{label}</Link>)}</div>
      </div>}
      <div className="page">{children}</div>
    </div>
  </div>
}

function OrganizerTrips() {
  return <OrganizerShell><div className="pageHeading"><div><span className="eyebrow">Workspace</span><h1>My Trips</h1><p>Trips that need your attention appear first.</p></div><Button>＋ Create trip</Button></div>
    <div className="sectionLabel">Needs your attention <span>1</span></div>
    <Link to={`/organizer/trip/${trip.id}/collect`} className="tripCard">
      <div className="tripDate"><strong>14</strong><span>AUG</span></div>
      <div className="tripCardBody"><div className="tripTitle"><h2>{trip.name}</h2><Badge tone="purple">Organizer</Badge></div><p>{trip.destination} · {trip.dates}</p><div className="progressBar"><span style={{ width: '38%' }} /></div><small>4 of 6 preferences submitted · Review closes Friday</small></div>
      <div className="tripAction"><Badge tone="orange">Collecting</Badge><strong>Review responses →</strong></div>
    </Link>
    <div className="sectionLabel">Upcoming <span>1</span></div>
    <div className="tripCard mutedCard"><div className="tripDate"><strong>03</strong><span>DEC</span></div><div className="tripCardBody"><div className="tripTitle"><h2>Annual ski weekend</h2><Badge>Participant</Badge></div><p>Park City, Utah · December 3–7, 2026</p><small>Final plan published · No action needed</small></div><div className="tripAction"><Badge tone="green">Final</Badge></div></div>
  </OrganizerShell>
}

function PageIntro({ eyebrow, title, children, action }) { return <div className="pageHeading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}</div> }

function CollectPage() {
  const nav = useNavigate()
  return <OrganizerShell><PageIntro eyebrow="Step 1 of 5" title="Collect preferences" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/insights`)}>Continue with 4 responses →</Button>}>See who has responded. Missing responses are not treated as flexible and will not be represented in the plan.</PageIntro>
    <div className="notice noticeBlue"><strong>Response window open</strong><span>{trip.deadline}</span><Button secondary>Copy invitation link</Button></div>
    <div className="metricRow"><Metric value="4 / 6" label="Submitted"/><Metric value="1" label="In progress"/><Metric value="1" label="Not started"/><Metric value="67%" label="Response coverage"/></div>
    <section className="panel"><div className="panelHeader"><div><h2>Participants</h2><p>Only submission status is visible here. Private preferences remain protected.</p></div><Button secondary>Remind pending</Button></div>
      <div className="memberList">{members.map(m => <div className="memberRow" key={m.name}><span className="memberAvatar">{m.avatar}</span><div><strong>{m.name}</strong><small>{m.role}</small></div><span className="spacer"/><Badge tone={m.status === 'Submitted' ? 'green' : m.status === 'In progress' ? 'orange' : 'neutral'}>{m.status}</Badge>{m.status !== 'Submitted' && <button className="textBtn">Send reminder</button>}</div>)}</div>
    </section>
    <div className="notice noticeWarn"><strong>Continue without everyone?</strong><span>This plan will reflect 4 submitted responses. Liam and Ethan are not represented until they submit.</span></div>
  </OrganizerShell>
}

function Metric({ value, label }) { return <div className="metric"><strong>{value}</strong><span>{label}</span></div> }

function InsightsPage() {
  const nav = useNavigate()
  return <OrganizerShell><PageIntro eyebrow="Step 2 of 5" title="Group insights" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/plan`)}>Generate recommended plan →</Button>}>Deterministic rules calculate overlap. AI explains the trade-offs without exposing private responses.</PageIntro>
    <div className="insightGrid">{insights.map(x => <article className={`insight insight-${x.tone}`} key={x.label}><span>{x.label}</span><strong>{x.value}</strong><p>{x.detail}</p></article>)}</div>
    <div className="twoCol"><section className="panel"><div className="panelHeader"><div><h2>Availability overlap</h2><p>Submitted respondents only</p></div><Badge tone="green">Feasible</Badge></div><CalendarStrip/><div className="aiBox"><span>✦</span><div><strong>AI explanation</strong><p>August 14–17 is the only three-night window shared by every submitted respondent.</p></div></div></section>
      <section className="panel"><div className="panelHeader"><div><h2>Main planning trade-off</h2><p>Budget ↔ central location</p></div><Badge tone="orange">1 trade-off</Badge></div><div className="tradeScale"><div><strong>Lower cost</strong><span>Stay farther out</span></div><div className="tradeLine"><i/></div><div><strong>Central stay</strong><span>+$38 per person</span></div></div><div className="privateBox"><span>🔒</span><div><strong>Private constraints protected</strong><p>The recommended plan can satisfy all submitted must-haves. Original private text is not shown.</p></div></div></section></div>
    <section className="panel"><div className="panelHeader"><div><h2>What the plan generator will optimize</h2><p>Priority order is explicit and reviewable.</p></div></div><div className="priorityList"><span><b>1</b>Submitted must-haves</span><span><b>2</b>Shared availability</span><span><b>3</b>Comfortable budgets</span><span><b>4</b>Lowest satisfaction risk</span><span><b>5</b>Flexible preferences</span></div></section>
  </OrganizerShell>
}

function CalendarStrip() { return <div className="calendarStrip">{['12 Wed','13 Thu','14 Fri','15 Sat','16 Sun','17 Mon','18 Tue'].map((d,i) => <div className={i >= 2 && i <= 5 ? 'selected' : ''} key={d}><strong>{d.split(' ')[0]}</strong><span>{d.split(' ')[1]}</span><small>{i >= 2 && i <= 5 ? '4/4' : i === 1 ? '3/4' : '2/4'}</small></div>)}</div> }

function AiExplanation({ explanation }) {
  return <details className="aiExplanation"><summary><span>✦</span><strong>Why this works</strong><em>{explanation.confidence}</em></summary><div className="aiDetail"><p>{explanation.why}</p><div><strong>What it satisfies</strong>{explanation.satisfies.map(x => <span key={x}>✓ {x}</span>)}</div><div><strong>Trade-off</strong><span>{explanation.tradeoff}</span></div></div></details>
}

function PlanCard({ section, reviewMode, onComment }) {
  return <article className="planCard" id={section.id}><div className="planCardTop"><span className="planIcon">{section.icon}</span><div><h2>{section.title}</h2><p>{section.summary}</p></div><Badge tone={section.badge.includes('review') ? 'orange' : 'neutral'}>{section.badge}</Badge></div><div className="planFacts">{section.details.map(x => <span key={x}>{x}</span>)}</div><AiExplanation explanation={section.explanation}/>{reviewMode && <div className="sectionActions"><span>Does this section work for you?</span><button className="textBtn">✓ Works for me</button><Button secondary onClick={() => onComment(section)}>Add a note</Button></div>}</article>
}

function PlanPage() {
  const nav = useNavigate()
  return <OrganizerShell><PageIntro eyebrow="Step 3 of 5" title="Recommended plan" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/review`)}>Send for group review →</Button>}>One shared plan generated from submitted constraints. Every section explains its reasoning and confidence.</PageIntro>
    <div className="notice noticePurple"><strong>✦ AI-generated draft</strong><span>All submitted must-haves passed deterministic validation. Prices marked as estimates still need verification.</span><Button secondary>Regenerate</Button></div>
    <div className="planLayout"><main>{planSections.map(s => <PlanCard section={s} key={s.id}/>)}</main><aside className="summaryRail"><h3>Plan health</h3><div className="healthItem"><span>Must-haves</span><strong className="greenText">All satisfied</strong></div><div className="healthItem"><span>Response coverage</span><strong>4 of 6</strong></div><div className="healthItem"><span>Estimated total</span><strong>$612 pp</strong></div><div className="healthItem"><span>Unverified items</span><strong>4</strong></div><hr/><h3>Internal alternatives</h3><p>AI compared a lower-cost stay and a more central stay before recommending this plan.</p><button className="textBtn">Compare drafts →</button></aside></div>
  </OrganizerShell>
}

function ReviewOrganizerPage() {
  const demo = useDemo(); const nav = useNavigate()
  return <OrganizerShell><PageIntro eyebrow="Step 4 of 5" title="Review feedback" action={<Button onClick={() => nav(`/organizer/trip/${trip.id}/final`)}>Check approval readiness →</Button>}>AI groups comments by plan section. Suggestions do not block approval; required adjustments do.</PageIntro>
    <div className="metricRow"><Metric value="4 / 6" label="Reviewed"/><Metric value="3" label="Accepted"/><Metric value="1" label="Needs adjustment"/><Metric value="4.1 / 5" label="Avg. satisfaction"/></div>
    <div className="twoCol reviewCols"><section className="panel"><div className="panelHeader"><div><h2>Feedback by section</h2><p>Private notes are summarized without member identity.</p></div></div>{feedback.map((f,i) => <div className="feedbackCard" key={f.section}><div className="feedbackTitle"><div><h3>{f.section}</h3><Badge tone={f.kind === 'Needs adjustment' ? 'orange' : 'blue'}>{f.kind}</Badge></div><span>{f.count} response{f.count > 1 ? 's' : ''}</span></div><p>“{f.note}”</p><div className="aiSuggestion"><strong>✦ AI suggestion</strong><p>{f.suggestion}</p><small>{f.impact}</small></div><div className="feedbackActions"><Button onClick={() => i === 0 && demo.setPlanUpdated(true)}>{i === 0 && demo.planUpdated ? 'Applied ✓' : 'Apply suggestion'}</Button><Button secondary>Keep current</Button><button className="textBtn">Edit manually</button></div></div>)}</section>
      <aside className="panel"><div className="panelHeader"><div><h2>Satisfaction</h2><p>Anonymous distribution</p></div></div><div className="satisfactionBars">{[0,1,2,1,0].map((v,i) => <div key={i}><span>{i+1}</span><i style={{height:`${18+v*38}px`}}/><small>{v}</small></div>)}</div><div className="privateBox"><span>↘</span><div><strong>Lowest score: 2 / 5</strong><p>Accepted, but one flexible preference remains unmet. This does not block approval.</p></div></div></aside></div>
  </OrganizerShell>
}

function FinalOrganizerPage() {
  const demo = useDemo()
  return <OrganizerShell><PageIntro eyebrow="Step 5 of 5" title="Finalize the trip">Publish only after the group approval threshold and all submitted must-haves pass.</PageIntro>
    <div className="approvalHero"><div className="approvalRing">80<small>%</small></div><div><Badge tone="green">Group approved</Badge><h2>Approval threshold reached</h2><p>4 of 5 eligible reviewers accepted. One participant has not reviewed and is not counted as approval.</p></div></div>
    <section className="panel checklist"><h2>Final checks</h2><div><span>✓</span><p><strong>Submitted must-haves</strong>All satisfied by the current plan</p></div><div><span>✓</span><p><strong>Group approval</strong>80% approval · threshold 70%</p></div><div><span>✓</span><p><strong>Required adjustments</strong>Day 2 start-time issue resolved</p></div><div><span>!</span><p><strong>Response coverage</strong>Plan represents 4 of 6 invited participants</p></div></section>
    <section className="decisionSummary"><span className="eyebrow">Decision summary</span><h2>Why this plan is ready</h2><p>It fits every submitted availability window, stays within most comfortable budgets, and satisfies all protected must-haves. The Day 2 start moved later after participant feedback. Two invited members did not submit preferences and are not represented.</p></section>
    <div className="finalActions"><Button secondary>Preview participant view</Button><Button onClick={() => {demo.setFinalized(true); demo.setGuestStage('final')}}>{demo.finalized ? 'Final plan published ✓' : 'Publish final plan'}</Button></div>
  </OrganizerShell>
}

function GuestShell({ children }) {
  const demo = useDemo()
  return <div className="guestShell"><header className="guestHeader"><Logo/><div className="guestTrip"><strong>{trip.name}</strong><span>{trip.dates}</span></div><div className="guestHeaderActions"><select aria-label="Demo participant state" value={demo.guestStage} onChange={e => demo.setGuestStage(e.target.value)}><option value="preferences">Preferences</option><option value="submitted">Waiting</option><option value="review">Plan review</option><option value="update">Plan update</option><option value="final">Final plan</option></select>{demo.saved ? <Link className="btn btnSecondary" to="/organizer">My Trips</Link> : <Button secondary onClick={() => demo.setSaved(true)}>Save to account</Button>}</div></header><main className="guestMain">{children}</main><footer className="guestFooter"><span>Private inputs are protected by your visibility settings.</span><Link to="/">Switch demo role</Link></footer></div>
}

function GuestPortal() {
  const demo = useDemo()
  return <GuestShell>{demo.guestStage === 'preferences' && <Preferences/>}{demo.guestStage === 'submitted' && <Submitted/>}{demo.guestStage === 'review' && <GuestReview/>}{demo.guestStage === 'update' && <GuestUpdate/>}{demo.guestStage === 'final' && <GuestFinal/>}</GuestShell>
}

function Preferences() {
  const demo = useDemo(); const [budget, setBudget] = useState(620); const [vibes,setVibes]=useState(['Food','Relaxed','Culture']); const [must,setMust]=useState('A private room and no activities before 9:00 AM.'); const [avoid,setAvoid]=useState('Very crowded nightlife venues.'); const [privacy,setPrivacy]=useState('ai'); const [quick,setQuick]=useState(false); const [question,setQuestion]=useState(null)
  const toggle=v=>setVibes(s=>s.includes(v)?s.filter(x=>x!==v):s.length<3?[...s,v]:s)
  return <div className="guestNarrow"><div className="guestIntro"><Badge tone="purple">No account needed</Badge><h1>Share your trip preferences</h1><p>Five quick questions help the group plan around what actually works for you.</p><span className="timeEstimate">About 60 seconds</span></div>
    <section className="formCard"><div className="question"><span className="qNum">1</span><div><h2>Which days can you join?</h2><p>Select every day you are available.</p></div></div><div className="datePicker">{['Thu 13','Fri 14','Sat 15','Sun 16','Mon 17','Tue 18'].map((d,i)=><button key={d} className={i>=1&&i<=4?'selected':''}><span>{d.split(' ')[0]}</span><strong>{d.split(' ')[1]}</strong></button>)}</div></section>
    <section className="formCard"><div className="question"><span className="qNum">2</span><div><h2>What total budget feels comfortable?</h2><p>Per person for the full trip, excluding flights.</p></div></div><div className="budgetValue">Up to <strong>${budget}</strong></div><input type="range" min="350" max="900" step="10" value={budget} onChange={e=>setBudget(e.target.value)}/><div className="rangeLabels"><span>$350</span><span>$900+</span></div></section>
    <section className="formCard"><div className="question"><span className="qNum">3</span><div><h2>Anything the trip must accommodate?</h2><p>Examples: accessibility, dietary needs, a firm budget limit, or a required time.</p></div></div><textarea rows="3" value={must} onChange={e=>setMust(e.target.value)}/><Visibility value={privacy} onChange={setPrivacy}/></section>
    <section className="formCard"><div className="question"><span className="qNum">4</span><div><h2>What should this trip feel like?</h2><p>Choose up to three.</p></div></div><div className="chipGrid">{['Relaxed','Food','Culture','Nature','Nightlife','Shopping','Adventure','Photography'].map(v=><button className={vibes.includes(v)?'selected':''} onClick={()=>toggle(v)} key={v}>{v}</button>)}</div></section>
    <section className="formCard"><div className="question"><span className="qNum">5</span><div><h2>Anything you definitely want to avoid?</h2><p>Optional · one sentence is enough.</p></div></div><input value={avoid} onChange={e=>setAvoid(e.target.value)}/></section>
    {!quick && <section className="quickCheckOffer"><span className="aiOrb">✦</span><div><h2>Want AI to check your answers?</h2><p>Optional. AI can structure your free text, spot ambiguity, and ask up to three important questions.</p></div><Button secondary onClick={()=>setQuick(true)}>Use AI Quick Check</Button></section>}
    {quick && <section className="quickCheck"><div className="quickTitle"><span className="aiOrb">✦</span><div><span className="eyebrow">AI Quick Check</span><h2>One detail needs confirmation</h2></div><Badge tone="purple">1 of 1</Badge></div><p>You wrote “private room.” How important is this?</p><div className="optionStack"><button className={question==='must'?'selected':''} onClick={()=>setQuestion('must')}><strong>Must be met</strong><span>I cannot join under a shared-room arrangement.</span></button><button className={question==='flexible'?'selected':''} onClick={()=>setQuestion('flexible')}><strong>Prefer, but flexible</strong><span>I would consider another arrangement.</span></button></div><div className="aiSummary"><strong>Structured summary</strong><span>Budget · Up to ${budget}</span><span>Dates · Aug 14–17</span><span>Vibe · {vibes.join(' · ')}</span><span>Protected condition · Private room · {question==='must'?'Must be met':'Needs confirmation'}</span></div></section>}
    <div className="submitBar"><div><strong>Your answers are saved automatically.</strong><span>You can return to this link before the deadline.</span></div><Button onClick={()=>demo.setGuestStage('submitted')}>Confirm and submit →</Button></div>
  </div>
}

function Visibility({ value, onChange }) { return <div className="visibility"><span>Who can see this?</span>{[['ai','AI only'],['organizer','AI + organizer'],['group','Everyone']].map(([v,l])=><button key={v} onClick={()=>onChange(v)} className={value===v?'selected':''}>{v==='ai'?'🔒':'○'} {l}</button>)}</div> }

function Submitted() { const demo=useDemo(); return <div className="centerState"><div className="successMark">✓</div><Badge tone="green">Preferences submitted</Badge><h1>You’re all set.</h1><p>Your responses are included in the current planning window. Come back to this same trip when the plan is ready.</p><div className="statusCard"><div><strong>4 of 6</strong><span>people submitted</span></div><div className="miniProgress"><i style={{width:'67%'}}/></div><small>{trip.deadline}</small></div><Button onClick={()=>demo.setGuestStage('review')}>Preview the plan review →</Button></div> }

function GuestReview() {
  const demo=useDemo()
  const openComment=s=>{demo.setSelectedSection(s); setTimeout(()=>document.getElementById('commentComposer')?.scrollIntoView({behavior:'smooth'}),20)}
  return <div className="guestWide"><div className="guestIntro reviewIntro"><Badge tone="blue">Plan ready for review</Badge><h1>Review the Chicago plan</h1><p>If everything works, accept once. If one part does not, add a note directly to that section.</p><span className="timeEstimate">Usually 20–30 seconds</span></div><div className="planLayout guestPlan"><main>{planSections.map(s=><PlanCard key={s.id} section={s} reviewMode onComment={openComment}/>)}</main><aside className="reviewRail"><strong>Your review</strong><span>{demo.selectedSection?'1 section has a note':'No issues added'}</span><p>Your satisfaction is anonymous and separate from acceptance.</p></aside></div>{demo.selectedSection && <CommentComposer/>}<div className="reviewSubmit"><div><label>Optional satisfaction <strong>{demo.satisfaction}/5</strong></label><input type="range" min="1" max="5" value={demo.satisfaction} onChange={e=>demo.setSatisfaction(Number(e.target.value))}/></div><Button onClick={()=>{demo.setReviewed(true);demo.setGuestStage(demo.selectedSection?'submitted':'submitted')}}>{demo.selectedSection?'Submit review':'Accept this plan'}</Button></div></div>
}

function CommentComposer() { const demo=useDemo(); return <section className="commentComposer" id="commentComposer"><div className="panelHeader"><div><span className="eyebrow">Note on</span><h2>{demo.selectedSection.title}</h2></div><button className="closeBtn" onClick={()=>demo.setSelectedSection(null)}>×</button></div><label>What should the group know?</label><textarea rows="3" value={demo.note} onChange={e=>demo.setNote(e.target.value)} placeholder="One sentence is enough…"/><label>How important is this?</label><div className="optionStack horizontal"><button className={demo.noteType==='suggestion'?'selected':''} onClick={()=>demo.setNoteType('suggestion')}><strong>Suggestion</strong><span>I can still accept the plan.</span></button><button className={demo.noteType==='required'?'selected':''} onClick={()=>demo.setNoteType('required')}><strong>Needs adjustment</strong><span>This section does not work for me.</span></button></div><Visibility value={demo.visibility} onChange={demo.setVisibility}/></section> }

function GuestUpdate() { const demo=useDemo(); return <div className="guestNarrow"><div className="guestIntro"><Badge tone="orange">One change needs your review</Badge><h1>Day 2 starts later</h1><p>Only this affected section needs your confirmation. Your acceptance for the rest of the plan stays in place.</p></div><section className="changeCard"><div className="compare"><div><span>Before</span><strong>8:00 AM</strong><p>Architecture cruise</p></div><div className="arrow">→</div><div className="after"><span>Now</span><strong>10:00 AM</strong><p>Architecture cruise</p></div></div><div className="aiBox"><span>✦</span><div><strong>Why it changed</strong><p>The later start addresses participant feedback without changing the budget. Lunch moves 45 minutes later.</p></div></div></section><div className="submitBar"><div><strong>Everything else is unchanged.</strong><span>Your previous acceptance is retained.</span></div><Button onClick={()=>demo.setGuestStage('final')}>Accept update</Button></div></div> }

function GuestFinal() { return <div className="guestWide"><div className="finalBanner"><div className="successMark smallMark">✓</div><div><Badge tone="green">Group approved · Final</Badge><h1>{trip.name}</h1><p>{trip.dates} · {trip.destination}</p></div></div><div className="planLayout guestPlan"><main>{planSections.map(s=><PlanCard key={s.id} section={s}/>)}</main><aside className="summaryRail"><h3>Approval summary</h3><div className="healthItem"><span>Accepted</span><strong>4 of 5</strong></div><div className="healthItem"><span>Approval</span><strong>80%</strong></div><div className="healthItem"><span>Must-haves</span><strong className="greenText">All satisfied</strong></div><hr/><p>This plan represents submitted responses. Two invitees did not submit preferences.</p></aside></div></div> }

export default function FinalApp() {
  return <DemoProvider><Routes><Route path="/" element={<Home/>}/><Route path="/organizer" element={<OrganizerTrips/>}/><Route path="/organizer/trip/:tripId/collect" element={<CollectPage/>}/><Route path="/organizer/trip/:tripId/insights" element={<InsightsPage/>}/><Route path="/organizer/trip/:tripId/plan" element={<PlanPage/>}/><Route path="/organizer/trip/:tripId/review" element={<ReviewOrganizerPage/>}/><Route path="/organizer/trip/:tripId/final" element={<FinalOrganizerPage/>}/><Route path="/t/:slug" element={<GuestPortal/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></DemoProvider>
}
