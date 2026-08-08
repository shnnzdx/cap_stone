import {
  getTripPreviewManifest,
  tripPreviewFrameSrc,
  tripPreviewWorkspaceTitle,
} from "./preview-config";

export default async function TripWorkspacePreview() {
  const preview = await getTripPreviewManifest();

  return (
    <main className="trip-preview-page">
      <iframe
        className="trip-preview-frame"
        src={tripPreviewFrameSrc}
        title={tripPreviewWorkspaceTitle}
      />
    </main>
  );
}
