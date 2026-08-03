import Link from "next/link";

export default function TripWorkspacePreview() {
  return (
    <main className="trip-preview-page">
      <header className="trip-preview-bar">
        <Link className="brand" href="/">
          <span className="brand-mark">T</span>
          TripSync
        </Link>
        <nav aria-label="Trip preview navigation">
          <Link href="/">Product intro</Link>
          <Link href="/login">Demo login</Link>
        </nav>
      </header>
      <iframe
        className="trip-preview-frame"
        src="/trip-app/"
        title="TripSync post-login workspace preview"
      />
    </main>
  );
}
