import Link from "next/link";
import Header from "./Header";

export { Header };

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand" href="/">
            <span className="brand-mark">T</span>TripSync
          </Link>
          <p>Plan a trip everyone can agree on.</p>
        </div>
        <div>
          <strong>Product</strong>
          <Link href="/#product-overview">Overview</Link>
          <Link href="/how-it-works">How It Works</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/faq">FAQ</Link>
        </div>
        <div>
          <strong>Account</strong>
          <Link href="/login">Log in</Link>
          <Link href="/signup?next=/trip">Create a trip</Link>
        </div>
      </div>
      <div className="shell copyright">© 2026 TripSync</div>
    </footer>
  );
}
