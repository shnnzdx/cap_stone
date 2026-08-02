/* ═══════════════════════════════════════════════════════════
   演示种子数据：芝加哥四人组。所有 mock 计划书、异常场景演示均基于此。
   Emma 预算 $1,500（硬约束 🔒 仅 AI）· Noah 美食夜生活（公开）
   Mia 博物馆与本地文化（公开）· Liam 不能久走（🔒 仅 AI）
   ═══════════════════════════════════════════════════════════ */

export const MEMBERS = [
  { id: 'emma', name: 'Emma', initial: 'E', role: 'organizer' },
  { id: 'noah', name: 'Noah', initial: 'N', role: 'member' },
  { id: 'mia',  name: 'Mia',  initial: 'M', role: 'member' },
  { id: 'liam', name: 'Liam', initial: 'L', role: 'member' },
]

/**
 * 计划部分卡数据。每张卡必备：
 *  credibility 可信度标签（mock | estimate | verified | unverified）
 *  state       部分状态徽章（accepted | pending | modified | violation | frozen）
 *  ai          AI 解释行（为什么这样安排 · 满足了谁 · 谁妥协）
 * body 按版本分叉，用于演示 v1 回看。
 */
export const PLAN_SECTIONS = [
  {
    id: 'overview', icon: '🗺', title: 'Overview',
    credibility: 'verified',
    body: {
      v2: '3 days in Chicago, Oct 10–12 · 4 people · museums + food focus · base: River North.',
      v1: '3 days in Chicago, Oct 10–12 · 4 people · museums + food focus · base: River North.',
    },
    ai: {
      summary: 'Why this structure',
      detail:
        'Museums cluster near the Loop, so Days 1–2 stay central. Satisfies the two culture-focused members; the food-tour member gets dedicated evening slots. Nobody compromises on the overall shape.',
    },
    state: { v2: 'accepted', v1: 'accepted' },
    memberCompromise: 'None in this section.',
  },
  {
    id: 'stay', icon: '🏨', title: 'Accommodation',
    credibility: 'estimate',
    body: {
      v2: 'Hampton Inn River North · $172/night · 3 nights · walkable to L stations.',
      v1: 'Kimpton Gray Hotel · $265/night · 3 nights.',
    },
    ai: {
      summary: 'Why this hotel',
      detail:
        'Chosen to satisfy 2 price conditions while keeping the central location the group agreed on. Trade-off: smaller rooms than the v1 pick.',
    },
    state: { v2: 'modified', v1: 'pending' },
    memberCompromise: 'Smaller rooms than the v1 pick.',
  },
  {
    id: 'day1', icon: '📅', title: 'Day 1 · Arrival + The Loop',
    credibility: 'verified',
    body: {
      v2: '14:00 check-in → Art Institute (3h) → Italian Village dinner → Riverwalk stroll. Est. $95/person.',
      v1: '14:00 check-in → Art Institute (3h) → Italian Village dinner → Riverwalk stroll. Est. $95/person.',
    },
    ai: {
      summary: 'Why this order',
      detail:
        'Late start absorbs different arrival times; the museum satisfies the culture preference; total walking ≤ 2km respects an anonymous mobility constraint 🔒.',
    },
    state: { v2: 'frozen', v1: 'accepted' },
    memberCompromise: 'None — walking cap matches your condition.',
  },
  {
    id: 'day2', icon: '📅', title: 'Day 2 · Museums + Food tour',
    credibility: 'estimate',
    body: {
      v2: "Field Museum (taxi, not walk) → lunch at Lou Malnati's → 2h rest at hotel → evening food crawl (3 stops, ends 21:30). Est. $130/person.",
      v1: 'Field Museum (2.5km walk along lakefront) → food crawl (5 stops, ends 23:30). Est. $150/person.',
    },
    ai: {
      summary: 'Why changed',
      detail:
        'Walking route replaced by taxi and a rest block added, satisfying an anonymous mobility condition 🔒. Food crawl kept but shortened — the nightlife requester compromises 2 stops.',
    },
    state: { v2: 'modified', v1: 'pending' },
    memberCompromise: 'Nothing this round — the rest block was added for a mobility condition.',
  },
  {
    id: 'day3', icon: '📅', title: 'Day 3 · Wicker Park + Departure',
    credibility: 'mock',
    body: {
      v2: 'Brunch → vintage shops → 15:00 head to O’Hare. Est. $60/person.',
      v1: 'Brunch → vintage shops → 15:00 head to O’Hare. Est. $60/person.',
    },
    ai: {
      summary: 'Why light',
      detail: 'Departure day kept flexible; no confirmed flight times yet (listed under clarifications).',
    },
    state: { v2: 'pending', v1: 'pending' },
    memberCompromise: 'None.',
  },
  {
    id: 'transport', icon: '🚇', title: 'Local transport',
    credibility: 'unverified',
    body: {
      v2: '3-day CTA pass $15/person + 2 shared taxis.',
      v1: '3-day CTA pass $15/person.',
    },
    ai: { summary: 'Why unverified', detail: 'Taxi fares are estimated from historic averages, not live pricing.' },
    state: { v2: 'pending', v1: 'pending' },
    memberCompromise: 'None.',
  },
  {
    id: 'cost', icon: '💰', title: 'Cost estimate',
    credibility: 'estimate',
    body: {
      v2: 'Total $1,420 / person (hotel 516 + food 420 + activities 300 + transport 184).',
      v1: 'Total $1,585 / person.',
    },
    ai: {
      summary: 'How this is calculated',
      detail: 'Per-person share of shared costs plus individual estimates. Compared against the group budget ceiling on every regeneration.',
    },
    state: { v2: 'accepted', v1: 'violation' },
    memberCompromise: 'None.',
  },
]

/** 修改摘要卡（v2 起置顶）：保留 / 改了 / 为什么 / 解决了谁 / 影响 */
export const CHANGE_SUMMARY = {
  v2: {
    kept: 'Overview, Day 1 (frozen), Day 3, local transport.',
    changed: 'Accommodation (hotel tier −1), Day 2 (shorter walking route, rest stop added).',
    why: '2 member conditions on hotel price · 1 anonymous mobility constraint.',
    resolved: '“≤$180/night” ✓ · “less walking on Day 2” ✓.',
    impact: '−$70/person; Day 2 ends 1h earlier; total now $1,420/person.',
  },
  v3: {
    kept: 'Everything else, including all sections you accepted.',
    changed: 'Day 3 (sit-down brunch added) · Local transport (taxi price verified).',
    why: '1 condition on brunch · 1 request to verify taxi pricing.',
    resolved: '“proper sit-down brunch” ✓.',
    impact: '+$10/person → $1,430 total, still under the cap ✓.',
  },
}

/** 团队审核状态（成员端只看得到聚合，看不到他人明细） */
export const TEAM_REVIEW = {
  responded: 2,
  total: 4,
  satisfaction: { min: 6, avg: 7.8 },
  rows: [
    { member: 'emma', label: 'Accepted', tone: 'ok' },
    { member: 'noah', label: 'Accept w/ conditions (1)', tone: 'warn' },
    { member: 'mia',  label: 'Pending', tone: 'neutral' },
    { member: 'liam', label: 'Pending', tone: 'neutral' },
  ],
}

/** 按部分分组的反馈聚合，矛盾条件并置 */
export const FEEDBACK_BY_SECTION = [
  { section: 'Accommodation', chips: ['≤$180/night (2 members)'], conflict: null },
  {
    section: 'Day 2',
    chips: ['More nightlife stops', 'End the day by 21:00'],
    conflict: 'These two conditions cannot both be satisfied.',
    aiCompromise: 'Crawl ends 21:30 with one extra stop — splits the difference.',
  },
  { section: 'Day 3', chips: ['Sit-down brunch'], conflict: null },
]

/** 修改预案卡：AI 改前预告（组织者专属） */
export const MODIFICATION_PROPOSAL = [
  { section: 'Day 3', basis: '1 condition: “want a proper sit-down brunch”', impact: '≈ +$10/person' },
  { section: 'Local transport', basis: '1 condition: verify taxi pricing', impact: 'none' },
]

/** Decision Log：版本历程、妥协记录、拍板记录、未满足条件 */
export const DECISION_LOG = [
  'v1 → v2: hotel tier lowered (2 price conditions) · Day 2 walking reduced (anonymous 🔒 constraint)',
  'Compromise: nightlife crawl shortened from 5 to 3 stops (partially met)',
  'Lock: unanimous, Oct 1 · rule = Unanimous',
  'Unmet condition: “hotel pool” — skipped, reason: no pool options within budget',
  'v2 → v2.1 (execution): dinner venue swap, no cost impact, no re-vote needed',
]
