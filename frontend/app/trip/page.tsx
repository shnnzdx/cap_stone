import Link from "next/link";
import {
  getTripPreviewManifest,
  tripPreviewFrameSrc,
  tripPreviewWorkspaceTitle,
} from "./preview-config";

export default async function TripWorkspacePreview() {
  const preview = await getTripPreviewManifest();

  return (
    <main className="trip-preview-page">
      <header className="trip-preview-bar">
        <Link className="trip-preview-brand" href="/">
          <span className="trip-preview-brand-mark">T</span>
          TripSync
        </Link>
        <nav className="trip-preview-links" aria-label="Trip preview navigation">
          <Link href="/">Product intro</Link>
          <Link href="/login">Demo login</Link>
          <Link href={tripPreviewFrameSrc}>Open workspace</Link>
        </nav>
        <p className="trip-preview-status">
          {preview
            ? `Embedded from ${preview.sourceApp}@${preview.sourceVersion ?? "dev"} on ${preview.syncedAt.slice(0, 10)}`
            : "Embedded workspace preview"}
        </p>
      </header>
      <iframe
        className="trip-preview-frame"
        src={tripPreviewFrameSrc}
        title={tripPreviewWorkspaceTitle}
      />
    </main>
  );
}
