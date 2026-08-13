/**
 * Normalize current runtime/domain facts into the frozen
 * `trip-navigation-policy` input concepts without executing navigation.
 *
 * Route-string parsing is intentionally out of scope here. Callers may provide
 * already-structured `WorkspaceRouteRef` objects for `currentRoute` or
 * `returnTarget`. When callers have workspace path strings, this module now
 * delegates parsing to the shared route codec rather than owning route grammar.
 */

import { parseWorkspaceRoute } from "../../../shared/trip-navigation-route/index.js";

const PLANNING_STATES = new Set(["planning", "planned", "upcoming"]);
const ACTIVE_STATES = new Set(["active", "traveling", "travelling", "current"]);
const ARCHIVED_STATES = new Set(["archived", "past", "past trip", "completed", "complete"]);
const MEMBERSHIP_ROLES = new Set(["participant", "organizer"]);
const INVITE_STEPS = new Set(["open", "complete"]);

export class NavigationNormalizationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "NavigationNormalizationError";
    this.code = code;
  }
}

/**
 * Normalize workspace/session facts from current Trip runtime and existing
 * backend auth/trip shapes into policy-ready access facts.
 *
 * @param {{
 *   hasAccountSession?: boolean,
 *   membershipId?: string | null,
 *   activeTripId?: string | null,
 *   currentUser?: Record<string, any> | null,
 *   memberships?: Array<Record<string, any>> | null,
 *   tripSummaries?: Array<Record<string, any>> | null,
 *   activeTrip?: Record<string, any> | null,
 *   restoredTripId?: string | null,
 *   restoredPreferredSection?: string | null,
 *   currentRoute?: Record<string, any> | null,
 *   currentRoutePath?: string | null,
 *   returnTarget?: Record<string, any> | null,
 *   returnTargetPath?: string | null,
 * }} input
 * @returns {{
 *   accessState: "signed-out" | "session-no-trip-access" | "trip-session",
 *   relevantTripsById: Record<string, {
 *     membership?: { role: "participant" | "organizer", identityKind: "guest" | "account" },
 *     state?: "planning" | "active" | "archived" | "unknown",
 *   }>,
 *   intent: {
 *     currentRoute?: Record<string, any>,
 *     returnTarget?: Record<string, any>,
 *     restoredSelection?: { tripId: string, preferredSection?: string },
 *   },
 * }}
 */
export function normalizeWorkspaceSessionFacts(input = {}) {
  const relevantTripsById = {};

  for (const membership of arrayOf(input.memberships)) {
    const tripId = requireString(
      membership.trip_id || membership.tripId,
      "membership-trip-id-missing",
      "Membership facts require a trip id.",
    );
    mergeTripFact(
      relevantTripsById,
      tripId,
      "membership",
      normalizeMembershipFact({
        role: membership.role,
        identityKind: "account",
      }),
    );
  }

  for (const trip of arrayOf(input.tripSummaries)) {
    const tripId = requireString(
      trip.id || trip.trip_id || trip.tripId,
      "trip-summary-id-missing",
      "Trip summary facts require a trip id.",
    );
    mergeTripFact(relevantTripsById, tripId, "state", normalizeTripState(trip.status));
    const role = trip.my_role || trip.myRole;
    if (role) {
      mergeTripFact(
        relevantTripsById,
        tripId,
        "membership",
        normalizeMembershipFact({
          role,
          identityKind: "account",
        }),
      );
    }
  }

  if (input.activeTrip) {
    const tripId = requireString(
      input.activeTrip.id || input.activeTrip.trip_id || input.activeTrip.tripId || input.activeTripId,
      "active-trip-id-missing",
      "Active trip facts require a trip id.",
    );
    mergeTripFact(
      relevantTripsById,
      tripId,
      "state",
      normalizeTripState(input.activeTrip.status),
    );
  }

  if (input.currentUser) {
    const tripId = input.currentUser.trip_id || input.currentUser.tripId || input.activeTripId;
    if (tripId) {
      mergeTripFact(
        relevantTripsById,
        tripId,
        "membership",
        normalizeMembershipFromCurrentUser(input.currentUser),
      );
    }
  }

  const intent = {};
  if (input.currentRoute || input.currentRoutePath) {
    intent.currentRoute = normalizeRouteInput(
      input.currentRoute,
      input.currentRoutePath,
      "current-route-invalid",
    );
  }
  if (input.returnTarget || input.returnTargetPath) {
    intent.returnTarget = normalizeRouteInput(
      input.returnTarget,
      input.returnTargetPath,
      "return-target-invalid",
    );
  }
  const restoredTripId = input.restoredTripId || null;
  if (restoredTripId) {
    intent.restoredSelection = {
      tripId: restoredTripId,
      ...(input.restoredPreferredSection ? { preferredSection: input.restoredPreferredSection } : {}),
    };
  }

  return {
    accessState: normalizeAccessState(input, relevantTripsById),
    relevantTripsById,
    intent,
  };
}

/**
 * Normalize invite/open/join facts without classifying repeated invite or
 * deciding which destination should win.
 *
 * @param {{
 *   token: string,
 *   step: "open" | "complete",
 *   inviteToken?: string | null,
 *   invitePreview?: Record<string, any> | null,
 *   inviteErrorStatus?: number | null,
 *   joinResult?: Record<string, any> | null,
 *   tripId?: string | null,
 * }} input
 * @returns {{
 *   invite: {
 *     token: string,
 *     validity: "valid" | "invalid" | "unknown",
 *     tripId?: string,
 *   },
 *   intent: {
 *     inviteFlow: { token: string, step: "open" | "complete" },
 *   },
 * }}
 */
export function normalizeInviteFlowFacts(input) {
  const token = requireString(
    input?.token,
    "invite-token-missing",
    "Invite normalization requires a token.",
  );
  const step = requireInviteStep(input?.step);
  const inviteToken = input?.inviteToken || token;
  if (inviteToken !== token) {
    throw new NavigationNormalizationError(
      "invite-token-mismatch",
      "Invite token facts must agree with the invite flow token.",
    );
  }

  const tripId = firstNonEmptyString([
    input?.tripId,
    input?.joinResult?.trip_id,
    input?.joinResult?.tripId,
    input?.invitePreview?.trip_id,
    input?.invitePreview?.tripId,
  ]);

  let validity = "unknown";
  if (input?.inviteErrorStatus === 404) {
    validity = "invalid";
  } else if (input?.invitePreview || input?.joinResult || tripId) {
    validity = "valid";
  }

  if (step === "complete" && validity === "valid" && !tripId) {
    throw new NavigationNormalizationError(
      "invite-trip-id-missing-for-complete",
      "Invite completion facts require a trip id.",
    );
  }

  return {
    invite: {
      token,
      validity,
      ...(tripId ? { tripId } : {}),
    },
    intent: {
      inviteFlow: {
        token,
        step,
      },
    },
  };
}

/**
 * @param {unknown} value
 */
function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * @param {unknown} value
 * @param {string} code
 * @param {string} message
 */
function requireString(value, code, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new NavigationNormalizationError(code, message);
  }
  return value.trim();
}

/**
 * @param {Array<unknown>} values
 */
function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return null;
}

/**
 * @param {Record<string, any>} currentUser
 */
function normalizeMembershipFromCurrentUser(currentUser) {
  const isGuest = Boolean(
    currentUser.is_guest ??
    currentUser.isGuest,
  );
  const identityKind = isGuest ? "guest" : "account";
  return normalizeMembershipFact({
    role: currentUser.role,
    identityKind,
  });
}

/**
 * @param {{ role?: unknown, identityKind: "guest" | "account" }} input
 */
function normalizeMembershipFact(input) {
  const rawRole = typeof input.role === "string" ? input.role.trim().toLowerCase() : "";
  if (rawRole === "guest") {
    if (input.identityKind !== "guest") {
      throw new NavigationNormalizationError(
        "membership-role-identity-conflict",
        "Guest role facts require a guest identity.",
      );
    }
    return { role: "participant", identityKind: "guest" };
  }
  if (!MEMBERSHIP_ROLES.has(rawRole)) {
    throw new NavigationNormalizationError(
      "membership-role-invalid",
      "Membership facts require role organizer, participant, or guest.",
    );
  }
  if (rawRole === "organizer" && input.identityKind === "guest") {
    throw new NavigationNormalizationError(
      "guest-organizer-role",
      "Guest-backed memberships cannot be organizers.",
    );
  }
  return {
    role: /** @type {"participant" | "organizer"} */ (rawRole),
    identityKind: input.identityKind,
  };
}

/**
 * @param {unknown} value
 */
function normalizeTripState(value) {
  if (typeof value !== "string" || value.trim() === "") return "unknown";
  const normalized = value.trim().toLowerCase();
  if (PLANNING_STATES.has(normalized)) return "planning";
  if (ACTIVE_STATES.has(normalized)) return "active";
  if (ARCHIVED_STATES.has(normalized)) return "archived";
  return "unknown";
}

/**
 * @param {{ kind?: unknown }} route
 * @param {string} code
 */
function normalizeRouteRef(route, code) {
  if (!route || typeof route !== "object" || typeof route.kind !== "string") {
    throw new NavigationNormalizationError(
      code,
      "Route intents must already be structured WorkspaceRouteRef objects.",
    );
  }
  return route;
}

/**
 * @param {Record<string, any> | null | undefined} route
 * @param {string | null | undefined} routePath
 * @param {string} code
 */
function normalizeRouteInput(route, routePath, code) {
  if (route && routePath) {
    throw new NavigationNormalizationError(
      "route-input-conflict",
      "Provide either a structured route ref or a route path, not both.",
    );
  }
  if (route) {
    return normalizeRouteRef(route, code);
  }
  const parsed = parseWorkspaceRoute(routePath);
  if (!parsed) {
    throw new NavigationNormalizationError(
      code,
      "Route paths must be valid workspace paths parsed through the shared route codec.",
    );
  }
  return parsed;
}

/**
 * @param {{
 *   hasAccountSession?: boolean,
 *   membershipId?: string | null,
 *   activeTripId?: string | null,
 *   currentUser?: Record<string, any> | null,
 *   memberships?: Array<Record<string, any>> | null,
 * }} input
 * @param {Record<string, { membership?: { role: string, identityKind: string } }>} relevantTripsById
 */
function normalizeAccessState(input, relevantTripsById) {
  const hasMembership = Object.values(relevantTripsById).some((fact) => Boolean(fact.membership));
  if (hasMembership) return "trip-session";

  const hasAccountSession = input.hasAccountSession === true;
  const hasSessionSignal = Boolean(
    hasAccountSession ||
    input.membershipId ||
    input.activeTripId ||
    input.currentUser ||
    arrayOf(input.memberships).length > 0,
  );
  return hasSessionSignal ? "session-no-trip-access" : "signed-out";
}

/**
 * @param {Record<string, any>} relevantTripsById
 * @param {string} tripId
 * @param {"membership" | "state"} key
 * @param {any} value
 */
function mergeTripFact(relevantTripsById, tripId, key, value) {
  const next = relevantTripsById[tripId] || {};
  if (key === "membership" && next.membership) {
    const sameRole = next.membership.role === value.role;
    const sameIdentity = next.membership.identityKind === value.identityKind;
    if (!sameRole || !sameIdentity) {
      throw new NavigationNormalizationError(
        "membership-fact-conflict",
        `Conflicting membership facts were provided for trip ${tripId}.`,
      );
    }
  }
  if (key === "state" && next.state && next.state !== value && value !== "unknown") {
    throw new NavigationNormalizationError(
      "trip-state-conflict",
      `Conflicting trip state facts were provided for trip ${tripId}.`,
    );
  }
  if (key === "state" && value === "unknown" && next.state) {
    relevantTripsById[tripId] = next;
    return;
  }
  relevantTripsById[tripId] = {
    ...next,
    [key]: value,
  };
}

/**
 * @param {unknown} value
 */
function requireInviteStep(value) {
  if (typeof value !== "string" || !INVITE_STEPS.has(value)) {
    throw new NavigationNormalizationError(
      "invite-step-invalid",
      "Invite normalization requires step open or complete.",
    );
  }
  return /** @type {"open" | "complete"} */ (value);
}
