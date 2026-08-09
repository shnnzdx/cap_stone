import {
  demoBaseUpdates,
  demoGuestDraft,
  demoInitialComments,
  demoInitialDays,
  demoOtherTrips,
  demoPersonalUpdates,
  demoRouteSegments,
  demoTrip,
  demoTripMembers,
  demoTripStyles,
} from "../../../shared/tripsync-demo-data.js";

export const tripMembers = demoTripMembers;

export const trip = {
  ...demoTrip,
  id: import.meta.env.VITE_TRIP_ID || demoTrip.id,
};

export const otherTrips = demoOtherTrips;
export const initialDays = demoInitialDays;
export const routeSegments = demoRouteSegments;
export const tripStyles = demoTripStyles;
export const baseUpdates = demoBaseUpdates;
export const personalUpdates = demoPersonalUpdates;
export const initialComments = demoInitialComments;
export const guestDraft = demoGuestDraft;
