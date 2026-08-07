export const members = [
  { name: 'Emma', status: 'Submitted', role: 'Organizer', avatar: 'EM' },
  { name: 'Noah', status: 'Submitted', role: 'Participant', avatar: 'NO' },
  { name: 'Mia', status: 'Submitted', role: 'Participant', avatar: 'MI' },
  { name: 'Liam', status: 'In progress', role: 'Participant', avatar: 'LI' },
  { name: 'Ava', status: 'Submitted', role: 'Participant', avatar: 'AV' },
  { name: 'Ethan', status: 'Not started', role: 'Participant', avatar: 'ET' },
]

export const trip = {
  id: 'chicago-birthday',
  name: "Mia's 30th in Chicago",
  destination: 'Chicago, Illinois',
  dates: 'August 14–17, 2026',
  deadline: 'Closes Friday at 6:00 PM',
  people: 6,
}

export const insights = [
  { label: 'Best shared dates', value: 'Aug 14–17', detail: 'Works for 4 of 4 submitted responses', tone: 'blue' },
  { label: 'Comfortable total budget', value: '$520–$680', detail: 'Per person · excluding flights', tone: 'green' },
  { label: 'Private must-haves', value: '3 protected', detail: 'All can be accommodated', tone: 'purple' },
]

export const planSections = [
  {
    id: 'overview', icon: '✦', title: 'Trip overview', badge: 'Verified structure',
    summary: 'A relaxed long weekend built around food, architecture, and one celebratory night out.',
    details: ['3 nights · River North base', 'Balanced pace · no starts before 9:30 AM', 'Estimated total: $612 per person'],
    explanation: {
      why: 'This shape fits the shared date window and keeps the full trip inside most submitted comfort budgets.',
      satisfies: ['All submitted availability', 'A balanced pace requested by most respondents', 'All protected must-haves'],
      tradeoff: 'One flexible preference for a fourth night is not included.', confidence: 'AI synthesis · based on submitted responses'
    }
  },
  {
    id: 'stay', icon: '⌂', title: 'Stay · River North', badge: 'AI estimate',
    summary: 'Boutique hotel near the Red Line, selected for access without paying peak Loop rates.',
    details: ['3 nights · 2 rooms', '$214 per person', '6-minute walk to transit'],
    explanation: {
      why: 'River North reduces daily transfers while staying below the group’s upper comfort range.',
      satisfies: ['Private room requirement', 'Easy transit access', 'Preference for a central neighborhood'],
      tradeoff: 'About $38 more per person than the lowest-cost option.', confidence: 'AI estimate · price not yet verified'
    }
  },
  {
    id: 'day1', icon: '1', title: 'Day 1 · Arrive and settle in', badge: 'Low risk',
    summary: 'Flexible arrivals, hotel check-in, Riverwalk sunset, and a casual group dinner.',
    details: ['4:00 PM · Check-in', '6:00 PM · Riverwalk', '7:30 PM · Dinner in River North'],
    explanation: {
      why: 'The first evening stays flexible because arrival times vary across the group.',
      satisfies: ['No ticketed activity on arrival day', 'Local food priority', 'Low-pressure first evening'],
      tradeoff: 'No major attraction is scheduled on Day 1.', confidence: 'AI recommendation · opening hours verified later'
    }
  },
  {
    id: 'day2', icon: '2', title: 'Day 2 · Architecture and birthday dinner', badge: 'Needs review',
    summary: 'Architecture cruise, free afternoon, then the birthday dinner and rooftop drinks.',
    details: ['10:00 AM · Architecture cruise', '1:00 PM · Free time', '7:00 PM · Birthday dinner'],
    explanation: {
      why: 'A later start protects the group’s preferred pace while keeping the main celebration together.',
      satisfies: ['No early mornings', 'Architecture interest', 'One shared celebration'],
      tradeoff: 'The premium dinner uses more of the activity budget.', confidence: 'Cruise schedule verified · dinner price estimated'
    }
  },
  {
    id: 'day3', icon: '3', title: 'Day 3 · Neighborhood choice', badge: 'Flexible',
    summary: 'Choose between Wicker Park food stops or an art-focused afternoon in the West Loop.',
    details: ['10:30 AM · Brunch', '12:30 PM · Neighborhood option', '6:30 PM · Group meetup'],
    explanation: {
      why: 'A flexible afternoon absorbs different interests without splitting fixed transportation or lodging.',
      satisfies: ['Food, culture, and shopping tags', 'Independent time', 'Shared evening meetup'],
      tradeoff: 'Not every member attends the same afternoon activity.', confidence: 'AI recommendation · venues not yet verified'
    }
  },
  {
    id: 'budget', icon: '$', title: 'Budget summary', badge: 'AI estimate',
    summary: '$612 estimated total per person, excluding flights and personal shopping.',
    details: ['Hotel $214', 'Activities $138', 'Food $210', 'Local transit $50'],
    explanation: {
      why: 'The estimate stays within the shared comfortable range while preserving the birthday dinner.',
      satisfies: ['4 of 4 submitted comfort ranges', 'Protected maximum budget', 'Central accommodation'],
      tradeoff: 'Premium dinner limits room for an additional paid attraction.', confidence: 'AI estimate · live prices not connected'
    }
  },
]

export const feedback = [
  { section: 'Day 2 · Architecture and birthday dinner', kind: 'Needs adjustment', count: 1, note: 'The original 8:00 AM start was too early.', suggestion: 'Move the cruise to 10:00 AM.', impact: 'No budget change · lunch moves 45 minutes later.' },
  { section: 'Stay · River North', kind: 'Suggestion', count: 2, note: 'Please confirm there is a nearby train stop.', suggestion: 'Add verified walking time to the final plan.', impact: 'Information update only.' },
]
