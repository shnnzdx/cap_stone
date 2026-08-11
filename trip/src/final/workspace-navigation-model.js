import { tripNavigationPolicy } from "../../../shared/trip-navigation-policy/index.js";
import { serializeWorkspaceRoute } from "../../../shared/trip-navigation-route/index.js";
import {
  NavigationNormalizationError,
  normalizeInviteFlowFacts,
  normalizeWorkspaceSessionFacts,
} from "./navigation-normalizers.js";

/**
 * Compose the shared seams for runtime navigation presentation:
 *
 * current workspace runtime facts
 *   -> normalization
 * current workspace route path
 *   -> shared route codec
 * normalized facts + currentRoute
 *   -> tripNavigationPolicy.describeNavigation()
 * described destinations
 *   -> shared route serialization
 *
 * This module deliberately does not execute browser navigation or route guards.
 *
 * @param {{
 *   currentRoutePath: string,
 *   currentUser?: Record<string, any> | null,
 *   activeTrip?: Record<string, any> | null,
 *   activeTripId?: string | null,
 * }} input
 */
export function buildWorkspaceNavigationModel(input) {
  const normalized = normalizeWorkspaceSessionFacts({
    currentUser: input.currentUser,
    activeTrip: input.activeTrip,
    activeTripId: input.activeTripId,
    currentRoutePath: input.currentRoutePath,
  });
  const currentRoute = normalized.intent.currentRoute;

  if (!currentRoute) {
    throw new Error("Workspace navigation requires a currentRoute.");
  }

  const description = tripNavigationPolicy.describeNavigation({
    accessState: normalized.accessState,
    relevantTripsById: normalized.relevantTripsById,
    currentRoute,
  });

  return {
    currentRoute,
    contextRoute: description.contextRoute,
    contextHref: description.contextRoute
      ? serializeWorkspaceRoute(description.contextRoute)
      : null,
    entries: description.entries.map((entry) => ({
      ...entry,
      href: serializeWorkspaceRoute(entry.destination),
    })),
  };
}

/**
 * Compose the shared seams for current-route reachability:
 *
 * current workspace runtime facts
 *   -> normalization
 * current workspace route path
 *   -> shared route codec
 * normalized facts + currentRoute intent
 *   -> tripNavigationPolicy.resolveDestination()
 * resolved destination
 *   -> shared route serialization
 *
 * This remains a thin adapter. It does not execute browser navigation,
 * interpret policy meaning, or handle malformed catch-all routing.
 *
 * @param {{
 *   currentRoutePath: string,
 *   currentUser?: Record<string, any> | null,
 *   activeTrip?: Record<string, any> | null,
 *   activeTripId?: string | null,
 *   explain?: boolean,
 * }} input
 */
export function resolveCurrentWorkspaceRoute(input) {
  let normalized;
  try {
    normalized = normalizeWorkspaceSessionFacts({
      currentUser: input.currentUser,
      activeTrip: input.activeTrip,
      activeTripId: input.activeTripId,
      currentRoutePath: input.currentRoutePath,
    });
  } catch (error) {
    if (error instanceof NavigationNormalizationError && error.code === "current-route-invalid") {
      return null;
    }
    throw error;
  }
  const currentRoute = normalized.intent.currentRoute || null;

  if (!currentRoute) {
    return null;
  }

  const resolution = tripNavigationPolicy.resolveDestination({
    accessState: normalized.accessState,
    relevantTripsById: normalized.relevantTripsById,
    intent: { currentRoute },
  }, input.explain ? { explain: true } : undefined);
  const currentHref = serializeWorkspaceRoute(currentRoute);
  const destinationHref = serializeWorkspaceRoute(resolution.destination);

  if (resolution.disposition === "redirect" && destinationHref === currentHref) {
    throw new Error("Workspace route guard received a same-route redirect.");
  }

  return {
    currentRoute,
    currentHref,
    disposition: resolution.disposition,
    destination: resolution.destination,
    destinationHref,
    ...(resolution.diagnostics ? { diagnostics: resolution.diagnostics } : {}),
  };
}

/**
 * Compose the shared seams for restoration-time destination ownership:
 *
 * restored session facts + authoritative trip access facts
 *   -> normalizeWorkspaceSessionFacts()
 * current workspace route
 *   -> shared route codec
 * normalized restoredSelection + currentRoute
 *   -> tripNavigationPolicy.resolveDestination()
 * resolved destination
 *   -> shared route serialization
 *
 * This stays a thin adapter. It does not fetch facts, mutate session storage,
 * or execute browser navigation.
 *
 * @param {{
 *   currentRoutePath: string,
 *   authToken?: string | null,
 *   membershipId?: string | null,
 *   currentUser?: Record<string, any> | null,
 *   tripSummaries?: Array<Record<string, any>> | null,
 *   activeTrip?: Record<string, any> | null,
 *   activeTripId?: string | null,
 *   restoredTripId?: string | null,
 *   restoredPreferredSection?: string | null,
 *   explain?: boolean,
 * }} input
 */
export function resolveRestoredWorkspaceDestination(input) {
  let normalized;
  try {
    normalized = normalizeWorkspaceSessionFacts({
      authToken: input.authToken,
      membershipId: input.membershipId,
      currentUser: input.currentUser,
      tripSummaries: input.tripSummaries,
      activeTrip: input.activeTrip,
      activeTripId: input.activeTripId,
      restoredTripId: input.restoredTripId,
      restoredPreferredSection: input.restoredPreferredSection,
      currentRoutePath: input.currentRoutePath,
    });
  } catch (error) {
    if (error instanceof NavigationNormalizationError && error.code === "current-route-invalid") {
      return null;
    }
    throw error;
  }

  const currentRoute = normalized.intent.currentRoute || null;
  if (!currentRoute) {
    return null;
  }

  const resolution = tripNavigationPolicy.resolveDestination({
    accessState: normalized.accessState,
    relevantTripsById: normalized.relevantTripsById,
    intent: normalized.intent,
  }, input.explain ? { explain: true } : undefined);
  const currentHref = serializeWorkspaceRoute(currentRoute);
  const destinationHref = serializeWorkspaceRoute(resolution.destination);

  return {
    currentRoute,
    currentHref,
    disposition: resolution.disposition,
    destination: resolution.destination,
    destinationHref,
    ...(resolution.diagnostics ? { diagnostics: resolution.diagnostics } : {}),
  };
}

/**
 * Compose the shared seams for invite/join destination ownership:
 *
 * current join route
 *   -> shared route codec
 * runtime session facts
 *   -> normalizeWorkspaceSessionFacts()
 * runtime invite/join facts
 *   -> normalizeInviteFlowFacts()
 * combined normalized facts
 *   -> tripNavigationPolicy.resolveDestination()
 * resolved destination
 *   -> shared route serialization
 *
 * This remains a thin composition adapter. It does not infer repeated-invite
 * status, execute browser navigation, or own invite presentation state.
 *
 * @param {{
 *   currentRoutePath: string,
 *   currentUser?: Record<string, any> | null,
 *   activeTrip?: Record<string, any> | null,
 *   activeTripId?: string | null,
 *   membershipId?: string | null,
 *   token: string,
 *   step: "open" | "complete",
 *   invitePreview?: Record<string, any> | null,
 *   inviteErrorStatus?: number | null,
 *   joinResult?: Record<string, any> | null,
 *   inviteTripId?: string | null,
 *   explain?: boolean,
 * }} input
 */
export function resolveInviteJoinRoute(input) {
  let workspaceFacts;
  try {
    workspaceFacts = normalizeWorkspaceSessionFacts({
      membershipId: input.membershipId,
      currentUser: input.currentUser,
      activeTrip: input.activeTrip,
      activeTripId: input.activeTripId,
      currentRoutePath: input.currentRoutePath,
    });
  } catch (error) {
    if (error instanceof NavigationNormalizationError && error.code === "current-route-invalid") {
      return null;
    }
    throw error;
  }

  const currentRoute = workspaceFacts.intent.currentRoute || null;
  if (!currentRoute) {
    return null;
  }

  const inviteFacts = normalizeInviteFlowFacts({
    token: input.token,
    step: input.step,
    invitePreview: input.invitePreview,
    inviteErrorStatus: input.inviteErrorStatus,
    joinResult: input.joinResult,
    tripId: input.inviteTripId,
  });

  const resolution = tripNavigationPolicy.resolveDestination({
    accessState: workspaceFacts.accessState,
    relevantTripsById: workspaceFacts.relevantTripsById,
    invite: inviteFacts.invite,
    intent: {
      ...workspaceFacts.intent,
      ...inviteFacts.intent,
    },
  }, input.explain ? { explain: true } : undefined);
  const currentHref = serializeWorkspaceRoute(currentRoute);
  const destinationHref = serializeWorkspaceRoute(resolution.destination);

  if (resolution.disposition === "redirect" && destinationHref === currentHref) {
    throw new Error("Invite route adapter received a same-route redirect.");
  }

  return {
    currentRoute,
    currentHref,
    disposition: resolution.disposition,
    destination: resolution.destination,
    destinationHref,
    ...(resolution.diagnostics ? { diagnostics: resolution.diagnostics } : {}),
  };
}
