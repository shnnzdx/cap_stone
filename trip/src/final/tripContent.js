/* ═══════════════════════════════════════════════════════════════════
   全部 mock 数据集中在这一个文件。接后端时逐项替换,组件不用改。
   每一段都标了将来对应的接口。
   ═══════════════════════════════════════════════════════════════════ */

/* 成员名单。← GET /api/trips/:id/members
   名字是公开的(你当然知道同行的是谁),但**偏好内容永远不在这里**。
   这一页只回答"加没加入""交没交偏好",不回答"他要求了什么"。 */
export const tripMembers = [
  { id: 'u-emma', name: 'Emma Carter', initials: 'EC', role: 'organizer', joinMethod: 'creator', joined: true, preferencesSubmitted: true },
  { id: 'm-mia', name: 'Mia Chen', initials: 'MC', role: 'participant', joinMethod: 'invite_login', joined: true, preferencesSubmitted: true },
  { id: 'm-noah', name: 'Noah Reed', initials: 'NR', role: 'participant', joinMethod: 'invite_login', joined: true, preferencesSubmitted: true },
  { id: 'm-liam', name: 'Liam Ortiz', initials: 'LO', role: 'participant', joinMethod: 'invite_guest', joined: true, preferencesSubmitted: true, isGuest: true },
  { id: 'm-ava', name: 'Ava Park', initials: 'AP', role: 'participant', joinMethod: 'invite_guest', joined: true, preferencesSubmitted: false, isGuest: true },
  { id: 'm-pending', name: 'Invited · not joined yet', initials: '—', role: 'participant', joinMethod: 'invite_login', joined: false, preferencesSubmitted: false },
]

/* 演示用的主 trip。← GET /api/trips/:id */
export const trip = {
  id: import.meta.env.VITE_TRIP_ID || 'chicago-birthday',
  name: "Mia's 30th in Chicago",
  destination: 'Chicago, Illinois',
  dates: 'Aug 14–17, 2026',
  status: 'Traveling',
  people: 6,
}

/* Dashboard 上的其他 trip。← GET /api/trips
   注意:这几个目前没有独立行程数据,点进去会落到演示 trip。 */
export const otherTrips = [
  { id: 'lake-geneva', name: 'Lake house weekend', destination: 'Lake Geneva', dates: 'Sep 4–7', status: 'Upcoming', tone: 'blue', photo: 'photoLake', detail: 'Starts in 31 days' },
  { id: 'park-city', name: 'Annual ski weekend', destination: 'Park City', dates: 'Dec 3–7', status: 'Planning', tone: 'orange', photo: 'photoMountain', detail: 'Preferences in progress' },
  { id: 'new-orleans', name: 'New Orleans reunion', destination: 'New Orleans', dates: 'May 8–11', status: 'Past trip', tone: 'green', photo: 'photoNight', detail: 'View trip history' },
]

/* Current Plan。← GET /api/trips/:id/plans/current
   day.items 是变长数组,AI 生成多少条就渲染多少条,不要假设固定 3 条。 */
export const initialDays = [
  {
    id: 'day1', label: 'Day 1', date: 'Fri, Aug 14',
    title: 'Arrival and Riverwalk', summary: '3 activities · River North',
    items: [
      { id: 'checkin', kind: 'hotel', time: '4:00 PM', title: 'Hotel check-in', place: 'River North hotel', status: '', note: 'Drop bags and settle in.', coords: [41.8925, -87.6341], photoUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=72' },
      { id: 'riverwalk', kind: 'water', time: '6:00 PM', title: 'Riverwalk sunset', place: 'Chicago Riverwalk', status: '', note: 'A relaxed first shared activity.', coords: [41.8872, -87.6278], photoUrl: 'https://images.unsplash.com/photo-1494522358652-f30e61a60313?auto=format&fit=crop&w=600&q=72' },
      { id: 'welcome', kind: 'food', time: '7:30 PM', title: 'Welcome dinner', place: 'River North', status: 'Booked', note: 'Casual dinner near the hotel.', coords: [41.8934, -87.6350], photoUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=72' },
    ],
  },
  {
    id: 'day2', label: 'Day 2 · Today', date: 'Sat, Aug 15',
    title: 'Architecture and birthday dinner', summary: '3 activities · 1 booked',
    items: [
      { id: 'cruise', kind: 'water', time: '10:00 AM', title: 'Architecture cruise', place: 'Chicago River dock', status: 'Booked', note: 'Meet at the dock 20 minutes early.', coords: [41.8879, -87.6247], photoUrl: 'https://images.unsplash.com/photo-1590089415225-401ed6f9db8e?auto=format&fit=crop&w=600&q=72' },
      { id: 'afternoon', kind: 'museum', time: '2:00 PM', title: 'Art Institute of Chicago', place: 'Michigan Avenue', status: '', note: 'Flexible museum afternoon.', coords: [41.8796, -87.6237], photoUrl: 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=600&q=72' },
      { id: 'dinner', kind: 'food', time: '7:00 PM', title: 'Birthday dinner', place: 'River North', status: 'Booked', locked: true, note: 'Reservation for six.', coords: [41.8917, -87.6289], photoUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=72' },
    ],
  },
  {
    id: 'day3', label: 'Day 3', date: 'Sun, Aug 16',
    title: 'Neighborhood day and shared evening', summary: '3 activities · Flexible afternoon',
    items: [
      { id: 'brunch', kind: 'food', time: '10:30 AM', title: 'Late brunch', place: 'Near the hotel', status: '', note: 'Keep the morning relaxed.', coords: [41.8909, -87.6324], photoUrl: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=600&q=72' },
      { id: 'neighborhood', kind: 'walk', time: '1:00 PM', title: 'Wicker Park food walk', place: 'Wicker Park', status: '', note: 'Food and neighborhood stops.', coords: [41.9088, -87.6796], photoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=72' },
      { id: 'meetup', kind: 'meet', time: '6:30 PM', title: 'Group meetup', place: 'West Loop', status: '', note: 'The group regroups before dinner.', coords: [41.8840, -87.6470], photoUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=72' },
    ],
  },
]

/* 行程条目之间的路段。← 将来由 GET /api/plans/:id/route-segments 提供 */
export const routeSegments = ['0.8 km · 12 min walk', '1.4 km · 17 min walk', '0.6 km · 9 min walk']

export const tripStyles = ['Food', 'Nature', 'Relaxed', 'Culture', 'Adventure']

/* Updates > All 的既有条目。← GET /api/trips/:id/updates
   偏好类事件永远匿名:不出现成员姓名,只说 "A member"。 */
export const baseUpdates = [
  { id: 'base-1', kind: 'preference', icon: '◎', title: 'A member preference was updated', body: 'Cadensy re-checked the Current Plan. No activities were affected. Member identity stays hidden.', time: '9:50 AM' },
  { id: 'base-2', kind: 'plan', icon: '+', title: 'Birthday dinner reservation added', body: 'The 7:00 PM reservation is now marked as Booked.', time: 'Yesterday' },
]

/* Updates > For you。← GET /api/trips/:id/updates?scope=me
   这里可以出现姓名:公开评论和 @提及本来就是署名的,与匿名偏好是两回事。 */
export const personalUpdates = [
  { id: 'me-1', kind: 'preference', icon: '“', title: 'Mia added a note on Birthday dinner', body: 'Can we request a quieter table?', time: 'Yesterday' },
  { id: 'me-2', kind: 'plan', icon: '@', title: 'Noah mentioned you', body: 'Asked whether the architecture cruise still works for your arrival time.', time: 'Mon' },
]

/* 行程条目下的公开评论。← GET /api/plans/:id/sections/:sectionId/comments */
export const initialComments = {
  dinner: [{ name: 'Mia', text: 'Can we request a quieter table?' }],
}

/* Guest 打开邀请链接时的预填。← 真实场景由用户自己填写,不预填 */
export const guestDraft = { name: 'Mia Chen', email: 'mia@example.com' }
