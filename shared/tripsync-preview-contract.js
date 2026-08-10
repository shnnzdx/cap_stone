export const tripPreviewBasePath = "/trip-app";
export const tripPreviewDefaultHashRoute = "#/";
export const tripPreviewWorkspaceTitle = "TripSync workspace";

export function normalizeTripPreviewHashRoute(route = tripPreviewDefaultHashRoute) {
  if (!route) {
    return tripPreviewDefaultHashRoute;
  }

  if (route.startsWith("#")) {
    return route;
  }

  return route.startsWith("/") ? `#${route}` : `#/${route}`;
}

export function buildTripPreviewFrameSrc(route = tripPreviewDefaultHashRoute) {
  return `${tripPreviewBasePath}/index.html${normalizeTripPreviewHashRoute(route)}`;
}

export function buildTripPreviewAbsoluteUrl(origin, route = tripPreviewDefaultHashRoute) {
  return `${origin}${buildTripPreviewFrameSrc(route)}`;
}
