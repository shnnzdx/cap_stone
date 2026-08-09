export const tripWorkspaceSectionOrder = [
  ["plan", "Plan", "Draft itinerary"],
  ["chat", "Chat", "Personal thread"],
  ["conflict", "Conflict", "Tradeoff thread"],
  ["updates", "Updates", "Latest changes"],
  ["preferences", "Preferences", "Traveler inputs"],
  ["members", "Members", "Traveler list"],
  ["invite", "Invite", "Share access"],
];

export const accountSectionOrder = [
  ["profile", "Profile"],
  ["travel", "Travel"],
  ["notifications", "Notifications"],
  ["settings", "Settings"],
];

export const organizerStageOrder = tripWorkspaceSectionOrder;
export const guestStageOrder = accountSectionOrder;

export function buildTripWorkspaceHomePath() {
  return "/";
}

export function buildTripCreatePath() {
  return "/create";
}

export function buildTripAccountPath(section = "profile") {
  return `/account/${section}`;
}

export function buildTripWorkspaceSectionPath(tripId, section = "plan") {
  return `/trip/${tripId}/${section}`;
}

export function buildTripInvitePath(token) {
  return `/join/${token}`;
}

export function buildOrganizerHomePath() {
  return buildTripWorkspaceHomePath();
}

export function buildOrganizerArchivedPath() {
  return buildTripWorkspaceHomePath();
}

export function buildOrganizerCreatePath() {
  return buildTripCreatePath();
}

export function buildOrganizerAccountPath() {
  return buildTripAccountPath("profile");
}

export function buildOrganizerSettingsPath() {
  return buildTripAccountPath("settings");
}

export function buildOrganizerTripStagePath(tripId, stage) {
  return buildTripWorkspaceSectionPath(tripId, stage);
}

export function buildOrganizerTripPreferencesPath(tripId) {
  return buildTripWorkspaceSectionPath(tripId, "preferences");
}

export function buildParticipantTripPath(tripId) {
  return buildTripWorkspaceSectionPath(tripId, "plan");
}

export function buildGuestInvitePath(token) {
  return buildTripInvitePath(token);
}
