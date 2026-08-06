export const organizerStageOrder = [
  ["collect", "Collect", "Preferences"],
  ["insights", "Insights", "Preference check"],
  ["plan", "Plan", "Draft itinerary"],
  ["review", "Review", "Suggested adjustment"],
  ["final", "Final", "Final plan"],
];

export const guestStageOrder = [
  ["preferences", "Preferences"],
  ["review", "Review"],
  ["final", "Final"],
];

export function buildOrganizerHomePath() {
  return "/organizer";
}

export function buildOrganizerArchivedPath() {
  return "/organizer/archived";
}

export function buildOrganizerCreatePath() {
  return "/organizer/create";
}

export function buildOrganizerAccountPath() {
  return "/organizer/account";
}

export function buildOrganizerSettingsPath() {
  return "/organizer/settings";
}

export function buildOrganizerTripStagePath(tripId, stage) {
  return `/organizer/trip/${tripId}/${stage}`;
}

export function buildOrganizerTripPreferencesPath(tripId) {
  return `/organizer/trip/${tripId}/preferences`;
}

export function buildParticipantTripPath(tripId) {
  return `/participant/trip/${tripId}`;
}

export function buildGuestInvitePath(slug) {
  return `/t/${slug}`;
}
