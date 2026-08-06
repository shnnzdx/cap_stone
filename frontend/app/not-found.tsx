import Link from "next/link";
import Header from "./Header";

export default function NotFound() {
  return <main className="not-found"><Header/><section className="lost shell"><div><p className="eyebrow">ERROR 404 / ROUTE NOT FOUND</p><h1>This route isn&apos;t on the itinerary.</h1><p>The page may have moved, or the link might be incomplete. Let&apos;s get you back on track.</p><div className="actions"><Link className="button dark" href="/">Back to home</Link><Link className="button ghost" href="/signup?next=/trips/new">Create a trip</Link></div></div><div className="lost-visual image-placeholder"><span>2D ILLUSTRATION PLACEHOLDER</span><strong>Suitcase character on an unfolded map</strong><small>Broken route line / 404 sign / subtle eye-follow interaction</small><b>404</b></div></section></main>;
}
