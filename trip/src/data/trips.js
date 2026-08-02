/* ═══════════════════════════════════════════════════════════
   Mock 数据层。接后端时只需把这里换成 API 调用，
   组件通过 TripContext 消费，不直接依赖数据来源。
   种子数据统一为芝加哥四人组（见 seed.js）。
   ═══════════════════════════════════════════════════════════ */

/** 组织者五阶段。id 同时是路由 segment：/organizer/trip/:tripId/:stage */
export const ORGANIZER_STAGES = [
  { id: 'collect', label: '① Collect' },
  { id: 'analyze', label: '② Analyze' },
  { id: 'plan',    label: '③ Plan' },
  { id: 'review',  label: '④ Review' },
  { id: 'lock',    label: '⑤ Lock' },
]

/** 成员三步。覆盖关系：① = Collect+Analyze，② = Plan+Review，③ = Lock */
export const MEMBER_STEPS = [
  { id: 'preferences', label: '① Share preferences' },
  { id: 'review',      label: '② Review the plan' },
  { id: 'confirm',     label: '③ Confirm the trip' },
]

/**
 * 每个 trip 记录：
 *  - done / current / locked 决定二级栏三态与深链是否放行
 *  - organizer 与 member 视角分开，因为两端阶段模型不同
 */
export const INITIAL_TRIPS = [
  {
    id: 'chicago',
    name: 'Chicago Trip',
    dates: 'Oct 10–12, 2026',
    people: 4,
    invitedBy: 'Emma',
    archived: false,
    status: { tone: 'warn', label: 'Round 2 · reviewing' },
    round: 2,
    version: 'v2',
    deadline: 'closes in 21h',
    organizer: { done: ['collect', 'analyze'], current: 'plan', locked: ['lock'] },
    member: {
      done: ['preferences'], current: 'review', locked: ['confirm'],
      lines: [
        'Step 2 of 3 · Review the plan',
        'Plan v2 is ready — please review the updated sections',
        'Round 2 · waiting for 2 of 5 members · closes in 21h',
      ],
    },
    listHint: { organizer: 'Action needed: review Plan v2', member: 'Plan v2 is ready — please review' },
  },
  {
    id: 'denver',
    name: 'Denver Ski Weekend',
    dates: 'Feb 6–8, 2027',
    people: 5,
    invitedBy: 'Noah',
    archived: false,
    status: { tone: 'neutral', label: 'Collecting' },
    round: 1,
    version: null,
    deadline: 'closes in 40h',
    organizer: { done: [], current: 'collect', locked: ['analyze', 'plan', 'review', 'lock'] },
    member: {
      done: [], current: 'preferences', locked: ['review', 'confirm'],
      lines: [
        'Step 1 of 3 · Share preferences',
        "You haven't submitted yet — takes about 3 minutes",
        'Waiting for you and 1 other member',
      ],
    },
    listHint: {
      organizer: 'Waiting for 2 of 5 members to share preferences',
      member: "You haven't shared preferences yet",
    },
  },
  {
    id: 'nyc',
    name: 'NYC Reunion',
    dates: 'Aug 14–17, 2026',
    people: 6,
    invitedBy: 'Mia',
    archived: false,
    status: { tone: 'ok', label: 'Locked · in execution' },
    round: 3,
    version: 'v2.1',
    deadline: '12 days to departure',
    organizer: { done: ['collect', 'analyze', 'plan', 'review'], current: 'lock', locked: [] },
    member: {
      done: ['preferences', 'review'], current: 'confirm', locked: [],
      lines: [
        'Step 3 of 3 · Confirm the trip',
        'You accepted v2 · the plan is locked',
        'Nothing needed from you — 12 days to departure',
      ],
    },
    listHint: { organizer: 'Locked — nothing to do', member: 'Nothing needed from you' },
  },
  {
    id: 'boston',
    name: 'Boston 2025',
    dates: 'Apr 3–6, 2025',
    people: 6,
    invitedBy: 'Liam',
    archived: true,
    status: { tone: 'neutral', label: 'Ended · archived' },
    round: 2,
    version: 'v3',
    deadline: 'ended',
    organizer: { done: ['collect', 'analyze', 'plan', 'review'], current: 'lock', locked: [] },
    member: {
      done: ['preferences', 'review'], current: 'confirm', locked: [],
      lines: ['Step 3 of 3 · Confirm the trip', 'Trip ended', 'Read-only archive'],
    },
    listHint: { organizer: 'Read-only archive', member: 'Read-only archive' },
  },
]

/** 阶段三态，供二级栏渲染与深链校验共用 */
export function stageState(progress, stageId) {
  if (progress.locked.includes(stageId)) return 'locked'
  if (stageId === progress.current) return 'current'
  if (progress.done.includes(stageId)) return 'done'
  return 'upcoming'
}
