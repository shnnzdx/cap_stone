import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildTripPreviewFrameSrc,
  tripPreviewBasePath,
  tripPreviewDefaultHashRoute,
  tripPreviewWorkspaceTitle,
} from "../../../shared/tripsync-preview-contract.js";

export { tripPreviewBasePath, tripPreviewDefaultHashRoute, tripPreviewWorkspaceTitle };
export const tripPreviewFrameSrc = buildTripPreviewFrameSrc();
export const tripPreviewManifestPath = path.join(
  process.cwd(),
  "public",
  "trip-app",
  "embed-manifest.json",
);

export type TripPreviewManifest = {
  appBasePath: string;
  defaultHashRoute: string;
  frameSrc: string;
  sourceApp: string;
  sourceVersion: string | null;
  syncedAt: string;
  files: string[];
};

export async function getTripPreviewManifest(): Promise<TripPreviewManifest | null> {
  try {
    const raw = await readFile(tripPreviewManifestPath, "utf8");
    return JSON.parse(raw) as TripPreviewManifest;
  } catch {
    return null;
  }
}
