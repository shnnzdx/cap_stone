/**
 * Pure workspace route codec.
 *
 * This module owns the canonical transformation between structured
 * `WorkspaceRouteRef` objects and workspace route strings such as:
 *
 *   /
 *   /create
 *   /account/profile
 *   /trip/demo-trip/plan
 *   /join/invite-token
 *
 * It intentionally does not know about host iframe URLs, hash prefixes,
 * React Router, browser navigation, or product policy.
 */

const ACCOUNT_SECTIONS = new Set(["profile", "travel", "notifications", "settings"]);
const TRIP_SECTIONS = new Set([
  "plan",
  "chat",
  "conflict",
  "updates",
  "preferences",
  "members",
  "invite",
]);

class WorkspaceRouteCodecError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   */
  constructor(code, message) {
    super(message);
    this.name = "WorkspaceRouteCodecError";
    this.code = code;
  }
}

/**
 * Parse a workspace route path into a structured route ref.
 *
 * Accepted inputs are workspace paths only, for example `/trip/t1/plan`.
 * Host URLs, `/trip-app/index.html#/...`, query strings, hash prefixes, and
 * non-canonical forms such as trailing slashes are rejected with `null`.
 *
 * @param {unknown} path
 * @returns {(
 *   | { kind: "home" }
 *   | { kind: "create-trip" }
 *   | { kind: "account", section: "profile" | "travel" | "notifications" | "settings" }
 *   | { kind: "trip", tripId: string, section: "plan" | "chat" | "conflict" | "updates" | "preferences" | "members" | "invite" }
 *   | { kind: "join", token: string }
 *   | null
 * )}
 */
export function parseWorkspaceRoute(path) {
  if (typeof path !== "string") return null;
  if (path === "/") return { kind: "home" };
  if (!path.startsWith("/")) return null;
  if (path.endsWith("/")) return null;
  if (path.includes("?") || path.includes("#")) return null;
  if (path.includes("//")) return null;
  if (path.startsWith("/trip-app/")) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return null;

  const segments = path.slice(1).split("/");
  if (segments.some((segment) => segment.length === 0)) return null;

  if (segments.length === 1 && segments[0] === "create") {
    return { kind: "create-trip" };
  }

  if (segments.length === 2 && segments[0] === "account") {
    const section = segments[1];
    if (!ACCOUNT_SECTIONS.has(section)) return null;
    return {
      kind: "account",
      section: /** @type {"profile" | "travel" | "notifications" | "settings"} */ (section),
    };
  }

  if (segments.length === 3 && segments[0] === "trip") {
    const tripId = decodeSegment(segments[1]);
    const section = segments[2];
    if (!tripId || !TRIP_SECTIONS.has(section)) return null;
    return {
      kind: "trip",
      tripId,
      section: /** @type {"plan" | "chat" | "conflict" | "updates" | "preferences" | "members" | "invite"} */ (section),
    };
  }

  if (segments.length === 2 && segments[0] === "join") {
    const token = decodeSegment(segments[1]);
    if (!token) return null;
    return {
      kind: "join",
      token,
    };
  }

  return null;
}

/**
 * Serialize a structured route ref into the canonical workspace path string.
 *
 * @param {unknown} routeRef
 * @returns {string}
 */
export function serializeWorkspaceRoute(routeRef) {
  if (!routeRef || typeof routeRef !== "object" || typeof routeRef.kind !== "string") {
    throw new WorkspaceRouteCodecError(
      "invalid-route-ref",
      "Workspace routes must be structured route refs.",
    );
  }

  switch (routeRef.kind) {
    case "home":
      return "/";
    case "create-trip":
      return "/create";
    case "account": {
      const section = routeRef.section;
      if (!ACCOUNT_SECTIONS.has(section)) {
        throw new WorkspaceRouteCodecError(
          "invalid-account-section",
          "Account routes require a supported account section.",
        );
      }
      return `/account/${section}`;
    }
    case "trip": {
      const tripId = requireDynamicSegment(
        routeRef.tripId,
        "missing-trip-id",
        "Trip routes require a trip id.",
      );
      const section = routeRef.section;
      if (!TRIP_SECTIONS.has(section)) {
        throw new WorkspaceRouteCodecError(
          "invalid-trip-section",
          "Trip routes require a supported trip section.",
        );
      }
      return `/trip/${encodeURIComponent(tripId)}/${section}`;
    }
    case "join": {
      const token = requireDynamicSegment(
        routeRef.token,
        "missing-join-token",
        "Join routes require a token.",
      );
      return `/join/${encodeURIComponent(token)}`;
    }
    default:
      throw new WorkspaceRouteCodecError(
        "unsupported-route-kind",
        `Unsupported workspace route kind: ${routeRef.kind}`,
      );
  }
}

/**
 * @param {unknown} value
 * @param {string} code
 * @param {string} message
 */
function requireDynamicSegment(value, code, message) {
  if (typeof value !== "string" || value.length === 0) {
    throw new WorkspaceRouteCodecError(code, message);
  }
  return value;
}

/**
 * @param {string} segment
 */
function decodeSegment(segment) {
  try {
    const value = decodeURIComponent(segment);
    return value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
