const demoStart = new Date();
demoStart.setHours(12, 0, 0, 0);
demoStart.setDate(demoStart.getDate() - 1);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const formatMonthDay = date => date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatDayLabel = date => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const demoEnd = addDays(demoStart, 3);
const demoYear = demoEnd.getFullYear();
const demoDateRange = `${formatMonthDay(demoStart)}-${demoEnd.getDate()}, ${demoYear}`;
const demoPhoto = name => `/trip-app/images/trip-photos/${name}`;

export const demoTripMembers = [
  { id: "u-emma", name: "Emma Carter", initials: "EC", role: "organizer", joinMethod: "creator", joined: true, preferencesSubmitted: true },
  { id: "m-mia", name: "Mia Chen", initials: "MC", role: "participant", joinMethod: "invite_login", joined: true, preferencesSubmitted: true },
  { id: "m-noah", name: "Noah Reed", initials: "NR", role: "participant", joinMethod: "invite_login", joined: true, preferencesSubmitted: true },
  { id: "m-liam", name: "Liam Ortiz", initials: "LO", role: "participant", joinMethod: "invite_guest", joined: true, preferencesSubmitted: true, isGuest: true },
  { id: "m-ava", name: "Ava Park", initials: "AP", role: "participant", joinMethod: "invite_guest", joined: true, preferencesSubmitted: false, isGuest: true },
  { id: "m-pending", name: "Invited - not joined yet", initials: "-", role: "participant", joinMethod: "invite_login", joined: false, preferencesSubmitted: false },
];

export const demoTrip = {
  id: "chicago-birthday",
  name: "Mia's 30th in Chicago",
  destination: "Chicago, Illinois",
  dates: demoDateRange,
  status: "Traveling",
  people: 6,
};

export const demoOtherTrips = [
  { id: "lake-geneva", name: "Lake house weekend", destination: "Lake Geneva", dates: "Sep 4-7", status: "Upcoming", tone: "blue", photo: "photoLake", detail: "Starts in 31 days" },
  { id: "park-city", name: "Annual ski weekend", destination: "Park City", dates: "Dec 3-7", status: "Planning", tone: "orange", photo: "photoMountain", detail: "Preferences in progress" },
  { id: "new-orleans", name: "New Orleans reunion", destination: "New Orleans", dates: "May 8-11", status: "Past trip", tone: "green", photo: "photoNight", detail: "View trip history" },
];

export const demoInitialDays = [
  {
    id: "day1",
    label: "Day 1",
    date: formatDayLabel(demoStart),
    title: "Arrival and Riverwalk",
    summary: "3 activities - River North",
    items: [
      { id: "checkin", kind: "hotel", time: "4:00 PM", title: "Hotel check-in", place: "River North hotel", status: "", note: "Drop bags and settle in.", coords: [41.8925, -87.6341], photoUrl: demoPhoto("hotel.jpg") },
      { id: "riverwalk", kind: "water", time: "6:00 PM", title: "Riverwalk sunset", place: "Chicago Riverwalk", status: "", note: "A relaxed first shared activity.", coords: [41.8872, -87.6278], photoUrl: demoPhoto("riverwalk.jpg") },
      { id: "welcome", kind: "food", time: "7:30 PM", title: "Welcome dinner", place: "River North", status: "Booked", note: "Casual dinner near the hotel.", coords: [41.8934, -87.635], photoUrl: demoPhoto("restaurant.jpg") },
    ],
  },
  {
    id: "day2",
    label: "Day 2 - Today",
    date: formatDayLabel(addDays(demoStart, 1)),
    title: "Architecture and birthday dinner",
    summary: "3 activities - 1 booked",
    items: [
      { id: "cruise", kind: "water", time: "10:00 AM", title: "Architecture cruise", place: "Chicago River dock", status: "Booked", note: "Meet at the dock 20 minutes early.", coords: [41.8879, -87.6247], photoUrl: demoPhoto("cruise.jpg") },
      { id: "afternoon", kind: "museum", time: "2:00 PM", title: "Art Institute of Chicago", place: "Michigan Avenue", status: "", note: "Flexible museum afternoon.", coords: [41.8796, -87.6237], photoUrl: demoPhoto("museum.jpg") },
      { id: "dinner", kind: "food", time: "7:00 PM", title: "Birthday dinner", place: "River North", status: "Booked", locked: true, note: "Reservation for six.", coords: [41.8917, -87.6289], photoUrl: demoPhoto("dinner.jpg") },
    ],
  },
  {
    id: "day3",
    label: "Day 3",
    date: formatDayLabel(addDays(demoStart, 2)),
    title: "Neighborhood day and shared evening",
    summary: "3 activities - Flexible afternoon",
    items: [
      { id: "brunch", kind: "food", time: "10:30 AM", title: "Late brunch", place: "Near the hotel", status: "", note: "Keep the morning relaxed.", coords: [41.8909, -87.6324], photoUrl: demoPhoto("brunch.jpg") },
      { id: "neighborhood", kind: "walk", time: "1:00 PM", title: "Wicker Park food walk", place: "Wicker Park", status: "", note: "Food and neighborhood stops.", coords: [41.9088, -87.6796], photoUrl: demoPhoto("wicker-food.jpg") },
      { id: "meetup", kind: "meet", time: "6:30 PM", title: "Group meetup", place: "West Loop", status: "", note: "The group regroups before dinner.", coords: [41.884, -87.647], photoUrl: demoPhoto("chicago-skyline.jpg") },
    ],
  },
];

export const demoRouteSegments = ["0.8 km - 12 min walk", "1.4 km - 17 min walk", "0.6 km - 9 min walk"];

export const demoTripStyles = ["Food", "Nature", "Relaxed", "Culture", "Adventure"];

export const demoBaseUpdates = [
  { id: "base-1", kind: "preference", icon: "o", title: "A member preference was updated", body: "Cadensy re-checked the Current Plan. No activities were affected. Member identity stays hidden.", time: "9:50 AM" },
  { id: "base-2", kind: "plan", icon: "+", title: "Birthday dinner reservation added", body: "The 7:00 PM reservation is now marked as Booked.", time: "Yesterday" },
];

export const demoPersonalUpdates = [
  { id: "me-1", kind: "preference", icon: "-", title: "Mia added a note on Birthday dinner", body: "Can we request a quieter table?", time: "Yesterday" },
  { id: "me-2", kind: "plan", icon: "@", title: "Noah mentioned you", body: "Asked whether the architecture cruise still works for your arrival time.", time: "Mon" },
];

export const demoInitialComments = {
  dinner: [{ name: "Mia", text: "Can we request a quieter table?" }],
};

export const demoGuestDraft = { name: "Mia Chen", email: "mia@example.com" };
