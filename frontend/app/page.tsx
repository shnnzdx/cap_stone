import Link from "next/link";
import { BrandConstellation, DemoPanel } from "./ui";
import FeatureStory from "./FeatureStory";
import PeopleProblem from "./PeopleProblem";
import ProductPrinciples from "./ProductPrinciples";
import ProductScrollFlow from "./ProductScrollFlow";

export default function Home() {
  return (
    <main>
      <Header />
      <ProductScrollFlow />
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">Group travel, planned together</p>
          <h1>Plan a trip everyone can agree on.</h1>
          <p className="lede">TripSync turns scattered needs into an explainable group plan—without asking anyone to give up control of their own conditions.</p>
          <div className="actions">
            <Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link>
            <Link className="button ghost" href="/how-it-works">See how it works</Link>
          </div>
          <p className="fineprint">Free to use · No credit card required</p>
        </div>
        <BrandConstellation />
      </section>

      <section className="section product-overview" id="product-overview">
        <div className="shell">
          <SectionIntro marker="01 · PRODUCT CORE" title="Built for real group decisions." text="AI helps the group understand and shape a plan. Deterministic checks and explicit member choices keep it trustworthy." />
          <ProductPrinciples />
        </div>
      </section>

      <PeopleProblem />

      <FeatureStory />

      <section className="section shell demo-section">
        <SectionIntro marker="04 · PREVIEW" title="See TripSync in action." text="Follow the group from private input to a plan everyone can confirm." />
        <DemoPanel />
      </section>

      <section className="final-cta">
        <div className="shell">
          <p className="eyebrow">READY WHEN YOUR GROUP IS</p>
          <h2>Many opinions. One plan.</h2>
          <Link className="button light" href="/signup?next=/trips/new">Create your trip</Link>
          <p className="fineprint">Free to use · No credit card required</p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

export function Header() {
  return <header className="site-header"><nav className="shell nav" aria-label="Main navigation"><Link className="brand" href="/"><span className="brand-mark">T</span>TripSync</Link><div className="nav-links"><Link href="/">Product</Link><Link href="/how-it-works">How It Works</Link><Link href="/privacy">Privacy</Link><Link href="/faq">FAQ</Link></div><div className="nav-actions"><Link href="/login">Log in</Link><Link className="button dark compact" href="/signup?next=/trips/new">Create a trip</Link></div></nav></header>;
}

export function Footer() {
  return <footer className="footer"><div className="shell footer-grid"><div><Link className="brand" href="/"><span className="brand-mark">T</span>TripSync</Link><p>Plan a trip everyone can agree on.</p></div><div><strong>Product</strong><Link href="/#product-overview">Overview</Link><Link href="/how-it-works">How It Works</Link><Link href="/privacy">Privacy</Link><Link href="/faq">FAQ</Link></div><div><strong>Account</strong><Link href="/login">Log in</Link><Link href="/signup?next=/trips/new">Create a trip</Link></div></div><div className="shell copyright">© 2026 TripSync</div></footer>;
}

function SectionIntro({marker, title, text}:{marker:string;title:string;text:string}) {
  return <div className="section-intro"><p className="eyebrow">{marker}</p><div><h2>{title}</h2><p>{text}</p></div></div>;
}
