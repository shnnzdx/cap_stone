import {
  demoBaseUpdates,
  demoGuestDraft,
  demoInitialComments,
  demoInitialDays,
  demoPersonalUpdates,
  demoRouteSegments,
  demoTrip,
  demoTripMembers,
  demoTripStyles,
} from "../../../shared/tripsync-demo-data.js";

export const demoDataEnabled = import.meta.env.VITE_ENABLE_DEMO_DATA === "1";

export const tripMembers = demoDataEnabled ? demoTripMembers : [];

export const trip = demoDataEnabled ? {
  ...demoTrip,
  id: import.meta.env.VITE_TRIP_ID || demoTrip.id,
} : null;

export const initialDays = demoDataEnabled ? demoInitialDays : [];
export const routeSegments = demoDataEnabled ? demoRouteSegments : [];
export const tripStyles = demoTripStyles;
export const baseUpdates = demoDataEnabled ? demoBaseUpdates : [];
export const personalUpdates = demoDataEnabled ? demoPersonalUpdates : [];
export const initialComments = demoDataEnabled ? demoInitialComments : {};
export const guestDraft = demoDataEnabled ? demoGuestDraft : { name: "", email: "" };
