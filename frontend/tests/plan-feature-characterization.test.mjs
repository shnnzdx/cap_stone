import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Candidate 3 characterization:
// These tests freeze the current PlanFeature behavior while extraction deepens.

const finalAppUrl = new URL("../../trip/src/final/FinalApp.jsx", import.meta.url);
const planFeatureUrl = new URL("../../trip/src/final/plan-feature/PlanFeature.jsx", import.meta.url);
const interactionRuntimeUrl = new URL("../../trip/src/final/plan-feature/usePlanInteractionRuntime.js", import.meta.url);
const assistantFlowUrl = new URL("../../trip/src/final/plan-feature/useAssistantChangeRequestFlow.js", import.meta.url);

async function loadFinalAppSource() {
  return readFile(finalAppUrl, "utf8");
}

async function loadPlanFeatureSource() {
  return readFile(planFeatureUrl, "utf8");
}

async function loadInteractionRuntimeSource() {
  return readFile(interactionRuntimeUrl, "utf8");
}

async function loadAssistantFlowSource() {
  return readFile(assistantFlowUrl, "utf8");
}

test("phase 2 FinalApp mounts PlanFeature behind a thin plan route wrapper and keeps imperative navigation execution local", async () => {
  const source = await loadFinalAppSource();

  assert.match(source, /import PlanFeature from '\.\/plan-feature\/PlanFeature\.jsx'/);
  assert.match(source, /function PlanRoute\(\) \{/);
  assert.match(source, /const handlePlanFeatureCommand = useCallback\(command => \{/);
  assert.match(source, /if \(!command \|\| command\.type !== 'navigate' \|\| !command\.to\) return/);
  assert.match(source, /window\.setTimeout\(\(\) => navigate\(command\.to\), command\.delayMs\)/);
  assert.match(source, /return <TripShell><PlanFeature onCommand=\{handlePlanFeatureCommand\}\/><\/TripShell>/);
  assert.match(source, /<Route path="\/trip\/:tripId\/plan" element={<PlanRoute\/>}\/>/);
});

test("phase 5 FinalApp no longer retains legacy plan-page orchestration after the PlanFeature cutover", async () => {
  const source = await loadFinalAppSource();

  assert.doesNotMatch(source, /import TripMap from '\.\/TripMap\.jsx'/);
  assert.doesNotMatch(source, /function NewTripPlan\(/);
  assert.doesNotMatch(source, /const groupCommentsByItem =/);
  assert.doesNotMatch(source, /function PlanPage\(/);
  assert.doesNotMatch(source, /function AssistantDrawer\(/);
  assert.doesNotMatch(source, /function ChangeConfirmCard\(/);
});

test("phase 4 PlanFeature consumes coherent view and actions surfaces from both deep hooks", async () => {
  const source = await loadPlanFeatureSource();

  assert.match(source, /import \{ usePlanInteractionRuntime \} from '\.\/usePlanInteractionRuntime\.js'/);
  assert.match(source, /import \{ useAssistantChangeRequestFlow \} from '\.\/useAssistantChangeRequestFlow\.js'/);
  assert.match(source, /const \{\s*view,\s*actions,\s*\} = usePlanInteractionRuntime\(\{ currentTrip \}\)/s);
  assert.match(source, /const \{\s*view,\s*actions,\s*\} = useAssistantChangeRequestFlow\(\{/s);
  assert.match(source, /onResolvedOutcome=\{resolution => \{/);
  assert.match(source, /if \(resolution\.kind === 'focus-item'\) \{/);
  assert.match(source, /actions\.closeDrawer\(\)\s*actions\.focusPlanItem\(resolution\.itemId\)/s);
  assert.match(source, /else if \(resolution\.kind === 'focus-round'\) \{/);
  assert.match(source, /actions\.closeDrawer\(\)\s*actions\.focusPlanItem\(resolution\.itemId, 'round'\)/s);
});

test("phase 3 interaction runtime currently shares selection across url focus, list selection, highlight, and map rail", async () => {
  const source = await loadInteractionRuntimeSource();

  assert.match(source, /const \[selectedTripItemId, setSelectedTripItemId\] = useState\(null\)/);
  assert.match(source, /const \[highlightedItemId, setHighlightedItemId\] = useState\(null\)/);
  assert.match(source, /const \[railDay, setRailDay\] = useState\('all'\)/);
  assert.match(source, /const focusPlanItem = useCallback\(\(itemId, target = 'item'\) => \{/);
  assert.match(source, /const dayId = itemDayById\[itemId\]/);
  assert.match(source, /if \(dayId\) setOpenDays\(current => current\.includes\(dayId\) \? current : \[\.\.\.current, dayId\]\)/);
  assert.match(source, /const focusItemId = new URLSearchParams\(location\.search\)\.get\('focus'\)/);
  assert.match(source, /if \(focusItemId && days\.length\) focusPlanItem\(focusItemId\)/);
  assert.match(source, /scrollIntoView\(\{ block: 'center', behavior: 'smooth' \}\)/);
  assert.match(source, /window\.setTimeout\(\(\) => setHighlightedItemId\(current => current === itemId \? null : current\), 1800\)/);
  assert.match(source, /const handleSelectTripItem = useCallback\(itemId => focusPlanItem\(itemId\), \[focusPlanItem\]\)/);
  assert.match(source, /const railDays = useMemo\(\(\) => railDay === 'all' \? days : days\.filter\(day => day\.id === railDay\), \[days, railDay\]\)/);
});

test("phase 3 interaction runtime currently owns comments polling lifecycle and local grouped comment state", async () => {
  const source = await loadInteractionRuntimeSource();

  assert.match(source, /const \[comments, setComments\] = useState\(\{\}\)/);
  assert.match(source, /const \[commenting, setCommenting\] = useState\(null\)/);
  assert.match(source, /const \[commentDraft, setCommentDraft\] = useState\(''\)/);
  assert.match(source, /const \[commentError, setCommentError\] = useState\(''\)/);
  assert.match(source, /if \(!app\.loadComments \|\| !days\.length\) return undefined/);
  assert.match(source, /const rows = await app\.loadComments\(\)/);
  assert.match(source, /setComments\(groupCommentsByItem\(rows\)\)/);
  assert.match(source, /setCommentError\(''\)/);
  assert.match(source, /setCommentError\('Could not load group notes\.'\)/);
  assert.match(source, /const timer = window\.setInterval\(load, 5000\)/);
  assert.match(source, /window\.clearInterval\(timer\)/);
});

test("phase 3 interaction runtime comment composer currently toggles inline per-item, posts through TripAppState, and resets locally", async () => {
  const source = await loadInteractionRuntimeSource();

  assert.match(source, /const toggleCommentComposer = useCallback\(itemId => \{/);
  assert.match(source, /setCommenting\(current => current === itemId \? null : itemId\)/);
  assert.match(source, /setMenuOpen\(null\)/);
  assert.match(source, /if \(!commentDraft\.trim\(\)\) return/);
  assert.match(source, /const saved = await app\.addComment\(id, commentDraft\.trim\(\)\)/);
  assert.match(source, /setComments\(current => \(\{\s*\.\.\.current,\s*\[id\]: \[\.\.\.\(current\[id\] \|\| \[\]\)\.filter\(comment => comment\.id !== saved\.id\), saved\],\s*\}\)\)/s);
  assert.match(source, /setCommentDraft\(''\)/);
  assert.match(source, /setCommenting\(null\)/);
  assert.match(source, /app\.notify\('Group note posted'\)/);
  assert.match(source, /setCommentError\(err\.status === 422 \? 'Write a note before posting\.' : 'Could not post this note\.'\)/);
  assert.match(source, /const cancelCommentComposer = useCallback\(\(\) => \{/);
});

test("phase 3 interaction runtime currently owns item menu behavior and booking toggles locally", async () => {
  const source = await loadInteractionRuntimeSource();

  assert.match(source, /const \[menuOpen, setMenuOpen\] = useState\(null\)/);
  assert.match(source, /if \(!menuOpen\) return/);
  assert.match(source, /if \(!event\.target\.closest\('\.moreWrap'\)\) setMenuOpen\(null\)/);
  assert.match(source, /const toggleMenu = useCallback\(itemId => \{/);
  assert.match(source, /setMenuOpen\(current => current === itemId \? null : itemId\)/);
  assert.match(source, /const openDrawer = useCallback\(\(item, mode, day\) => \{/);
  assert.match(source, /setDrawerMode\(mode\)/);
  assert.match(source, /setMenuOpen\(null\)/);
  assert.match(source, /const toggleBooked = useCallback\(async item => \{/);
  assert.match(source, /const nextBooked = item\.settledness !== 'booked'/);
  assert.match(source, /await app\.setItemBooked\(item\.id, nextBooked\)/);
  assert.match(source, /app\.notify\(nextBooked \? 'Marked as booked' : 'Booked status removed'\)/);
  assert.match(source, /app\.notify\(err\.status === 404 \? 'This plan item no longer exists\.' : 'Could not update booking status\.'\)/);
});

test("phase 3 interaction runtime currently owns drawer lifecycle state without absorbing drawer conversation behavior", async () => {
  const hookSource = await loadInteractionRuntimeSource();
  const featureSource = await loadPlanFeatureSource();

  assert.match(hookSource, /const \[drawerItem, setDrawerItem\] = useState\(null\)/);
  assert.match(hookSource, /const \[drawerMode, setDrawerMode\] = useState\('ask'\)/);
  assert.match(hookSource, /setDrawerItem\(day \? \{ \.\.\.item, dayLabel: `\$\{day\.label\}[\s\S]*?\$\{day\.date\}` \} : item\)/);
  assert.match(hookSource, /const closeDrawer = useCallback\(\(\) => setDrawerItem\(null\), \[\]\)/);
  assert.match(featureSource, /function AssistantDrawer\(\{ item, mode, onClose, onCommand, onResolvedOutcome, inline = false \}\)/);
});

test("phase 4 assistant flow currently owns drawer-local lifecycle, Cadensy conversation state, and backend error mapping", async () => {
  const source = await loadAssistantFlowSource();

  assert.match(source, /const \[pendingRedirect, setPendingRedirect\] = useState\(''\)/);
  assert.match(source, /const \[draft, setDraft\] = useState\(''\)/);
  assert.match(source, /const \[messages, setMessages\] = useState\(\[\]\)/);
  assert.match(source, /const \[sending, setSending\] = useState\(false\)/);
  assert.match(source, /setDraft\(promptExamples\[mode\] \|\| ''\)/);
  assert.match(source, /setMessages\(\[\]\)/);
  assert.match(source, /setPendingRedirect\(''\)/);
  assert.match(source, /setSending\(false\)/);
  assert.match(source, /const placeholder = mode === 'global'\s*\? 'Ask Cadensy or request a change\.\.\.'\s*: 'Ask about this item or request a change\.\.\.'/s);
  assert.match(source, /thread\.scrollTo\(\{ top: thread\.scrollHeight, behavior: 'smooth' \}\)/);
  assert.match(source, /window\.setTimeout\(\(\) => inputRef\.current\?\.focus\(\{ preventScroll: true \}\), 80\)/);
  assert.match(source, /const loadingId = `ai-loading-\$\{Date\.now\(\)\}`/);
  assert.match(source, /const userMessage = \{ id: `user-\$\{Date\.now\(\)\}`, from: 'you', text \}/);
  assert.match(source, /setMessages\(current => \[\.\.\.current, userMessage, \{ id: loadingId, from: 'tripSync', text: 'Thinking\.\.\.', loading: true \}\]\)/);
  assert.match(source, /const history = messages\s*\.filter\(message => !message\.loading && message\.text\)\s*\.map\(message => \(\{\s*role: message\.from === 'you' \? 'user' : 'assistant',\s*text: message\.text,\s*\}\)\)/s);
  assert.match(source, /const result = await app\.chatWithTrip\(\{ message: text, itemId, history \}\)/);
  assert.match(source, /text: result\.reply,\s*proposedChange: result\.proposed_change,\s*request: text,/s);
  assert.match(source, /const text = err\.status === 409\s*\? 'A vote is already open for this time block\.'\s*: err\.status === 422\s*\? 'Reopening this block needs a written reason\.'\s*: 'I could not reach the backend\. Try again in a moment\.'/s);
  assert.match(source, /setMessages\(current => current\.map\(message => message\.id === loadingId \? \{ \.\.\.message, text, loading: false, error: true \} : message\)\)/);
});

test("phase 4 assistant flow currently owns proposal apply state, submitChange branching, and confirm redirect command generation", async () => {
  const source = await loadAssistantFlowSource();

  assert.match(source, /const applyProposal = async \(message, proposedChange\) => \{/);
  assert.match(source, /const targetItem = itemById\[proposedChange\.item_id\] \|\| \(item\.id === proposedChange\.item_id \? item : \{ id: proposedChange\.item_id, title: proposedChange\.item_title \}\)/);
  assert.match(source, /updateMessage\(message\.id, \{ applying: true, applyError: '' \}\)/);
  assert.match(source, /const outcome = await app\.submitChange\(\{\s*item: targetItem,\s*actionType: mode,\s*request: message\.request,\s*verdict: proposedChange\.verdict,\s*patch: proposedChange\.patch,\s*\}\)/s);
  assert.match(source, /updateMessage\(message\.id, \{ applying: false, applied: true \}\)/);
  assert.match(source, /if \(outcome\.path === 'notice'\) \{\s*app\.notify\('Updated'\)\s*onResolvedOutcome\?\.\(\{ kind: 'focus-item', itemId: targetItem\.id, outcome, targetItem \}\)\s*\}/s);
  assert.match(source, /else if \(outcome\.path === 'round' \|\| outcome\.path === 'reopen_round'\) \{\s*app\.notify\('Vote opened'\)\s*onResolvedOutcome\?\.\(\{ kind: 'focus-round', itemId: targetItem\.id, outcome, targetItem \}\)\s*\}/s);
  assert.match(source, /else \{\s*setPendingRedirect\('Affected members need to confirm\. Opening the conversation\.\.\.'\)\s*onCommand\?\.\(\{ type: 'navigate', to: tripHref\(\(app\.trip \|\| trip\)\.id, 'conflict'\), delayMs: 850 \}\)\s*\}/s);
  assert.match(source, /const applyError = err\.status === 409\s*\? 'A vote is already open for this time block\.'\s*: err\.status === 422\s*\? 'Reopening this block needs a written reason\.'\s*: 'I could not reach the backend\. Try again in a moment\.'/s);
});

test("phase 4 AssistantDrawer consumes a coherent assistant-flow view and actions interface", async () => {
  const source = await loadPlanFeatureSource();

  assert.match(source, /const \{\s*view,\s*actions,\s*\} = useAssistantChangeRequestFlow\(\{/s);
  assert.match(source, /onResolvedOutcome,\s*\}\)/s);
  assert.match(source, /ref=\{view\.threadRef\}/);
  assert.match(source, /currentItem=\{view\.itemById\[message\.proposedChange\.item_id\]/);
  assert.match(source, /onApply=\{\(\) => actions\.applyProposal\(message, message\.proposedChange\)\}/);
  assert.match(source, /onDismiss=\{\(\) => actions\.dismissProposal\(message\.id\)\}/);
  assert.match(source, /view\.pendingRedirect && <p className="redirectHint">\{view\.pendingRedirect\}<\/p>/);
  assert.match(source, /ref=\{view\.inputRef\} value=\{view\.draft\} onChange=\{event => actions\.updateDraft\(event\.target\.value\)\}/);
  assert.match(source, /disabled=\{view\.sending \|\| !view\.draft\.trim\(\)\} onClick=\{actions\.sendMessage\}/);
});

test("phase 4 plan page currently owns loading, error, decision, and empty-created-plan notices", async () => {
  const source = await loadPlanFeatureSource();

  assert.match(source, /if \(currentTrip\.isCreated \|\| \(!app\.loading\.initial && view\.days\.length === 0\)\) return <NewTripPlan currentTrip=\{currentTrip\}\/>/);
  assert.match(source, /app\.loading\.initial && <div className="planNotice">[\s\S]*?<strong>Loading trip data<\/strong><p>Fetching the current plan from the backend\.<\/p>[\s\S]*?<\/div>/);
  assert.match(source, /app\.error && <div className="planNotice">[\s\S]*?<strong>Backend request failed<\/strong><p>\{app\.error\}<\/p>[\s\S]*?onClick=\{app\.refreshAll\}>Retry<\/button><\/div>/);
  assert.match(source, /app\.conflictCreated && !app\.decisionResolved && <Link className="planNotice" to=\{tripHref\(currentTrip\.id, 'updates'\)\}>[\s\S]*?<strong>Proposed change waiting for confirmation<\/strong>/);
  assert.match(source, /Proposed change waiting for confirmation/);
  assert.match(source, /app\.decisionResolved && <div className="successNotice">[\s\S]*?<strong>The plan was updated<\/strong><p>Every affected member confirmed\. Bookings elsewhere in the plan are unchanged\.<\/p>[\s\S]*?<\/div>/);
});
