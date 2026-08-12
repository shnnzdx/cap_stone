import Link from "next/link";
import { DemoPanel } from "./ui";
import BrandLogo from "./BrandLogo";
import FeatureStory from "./FeatureStory";
import HomeIntroSequence from "./HomeIntroSequence";
import PeopleProblem from "./PeopleProblem";
import ProductScrollFlow from "./ProductScrollFlow";
import ProductSectionTransitions from "./ProductSectionTransitions";
import SiteHeader from "./SiteHeader";

export default function Home() {
  return (
    <main className="product-page">
      <Header />
      <ProductScrollFlow />
      <ProductSectionTransitions />
      <HomeIntroSequence />

      <PeopleProblem />

      <FeatureStory />

      <section className="section shell demo-section">
        <SectionIntro marker="04 · CHANGE LOGIC" title="See one change find its path." />
        <DemoPanel />
      </section>

      <section className="final-cta">
        <div className="shell">
          <p className="eyebrow">READY TO PLAN TOGETHER</p>
          <h2>Different needs.<br />One shared plan.</h2>
          <Link className="button light" href="/signup?next=/trips/new">Create your trip</Link>
          <p className="fineprint">Free to use · No credit card required</p>
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
  return <footer className="footer"><div className="shell footer-grid"><div><Link className="brand" href="/"><BrandLogo /></Link><p>Personal needs. Shared decisions.</p></div><div><strong>Product</strong><Link href="/#product-overview">Overview</Link><Link href="/how-it-works">How It Works</Link><Link href="/privacy">Privacy</Link><Link href="/faq">FAQ</Link></div><div><strong>Account</strong><Link href="/login">Log in</Link><Link href="/signup?next=/trips/new">Create a trip</Link></div></div><div className="shell copyright"><span>© 2026 CADENSY</span><span className="brand-story">旅有谋 · 择道行 · 程皆宜</span></div></footer>;
}

function SectionIntro({marker, title}:{marker:string;title:string}) {
  return <div className="section-intro"><p className="eyebrow">{marker}</p><div><h2>{title}</h2></div></div>;
}
