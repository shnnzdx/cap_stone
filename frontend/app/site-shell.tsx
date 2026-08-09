import Link from "next/link";
import BrandLogo from "./BrandLogo";
import Header from "./Header";

export { Header };

export function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link className="brand" href="/">
            <BrandLogo />
          </Link>
          <p>Personal needs. Shared decisions.</p>
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
      <div className="shell copyright"><span>© 2026 CADENSY</span><span className="brand-story">旅有谋 · 择道行 · 程皆宜</span></div>
    </footer>
  );
}
