import Link from "next/link";
import { DemoPanel } from "./ui";
import FeatureStory from "./FeatureStory";
import HeroStory from "./HeroStory";
import PeopleProblem from "./PeopleProblem";
import ProductPrinciples from "./ProductPrinciples";
import ProductScrollFlow from "./ProductScrollFlow";
import SiteHeader from "./SiteHeader";

export default function Home() {
  return (
    <main className="product-page">
      <Header />
      <ProductScrollFlow />
      <HeroStory />

      <section className="section product-overview" id="product-overview">
        <div className="shell">
          <ProductPrinciples />
        </div>
      </section>

      <PeopleProblem />

      <FeatureStory />

      <section className="section shell demo-section">
        <SectionIntro marker="04 路 PREVIEW" title="See TripSync in action." />
        <DemoPanel />
      </section>

      <section className="final-cta">
        <div className="shell">
          <p className="eyebrow">READY WHEN YOUR GROUP IS</p>
          <h2>Many opinions. One plan.</h2>
          <Link className="button light" href="/signup?next=/trips/new">Create your trip</Link>
          <p className="fineprint">Free to use 路 No credit card required</p>
        </div>
      </section>
      <Footer />
    </main>
  );
}

export function Header() {
  return <SiteHeader />;
}

export function Footer() {
  return <footer className="footer"><div className="shell footer-grid"><div><Link className="brand" href="/"><span className="brand-mark">T</span>TripSync</Link><p>Plan a trip everyone can agree on.</p></div><div><strong>Product</strong><Link href="/#product-overview">Overview</Link><Link href="/how-it-works">How It Works</Link><Link href="/privacy">Privacy</Link><Link href="/faq">FAQ</Link></div><div><strong>Account</strong><Link href="/login">Log in</Link><Link href="/signup?next=/trips/new">Create a trip</Link></div></div><div className="shell copyright">漏 2026 TripSync</div></footer>;
}

function SectionIntro({marker, title}:{marker:string;title:string}) {
  return <div className="section-intro"><p className="eyebrow">{marker}</p><div><h2>{title}</h2></div></div>;
}
