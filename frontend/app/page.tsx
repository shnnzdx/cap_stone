import Link from "next/link";
import { BrandConstellation, DemoPanel } from "./ui";

const steps = [
  ["01", "Create", "Add a destination and dates, then invite the group with one link."],
  ["02", "Share", "Everyone shares what matters and chooses what stays private."],
  ["03", "Generate", "AI identifies conflicts and proposes a plan around confirmed constraints."],
  ["04", "Review", "Members rate the plan and leave feedback to guide the next change."],
  ["05", "Agree", "The trip locks only when every active member accepts the same version."],
];

export default function Home() {
  return (
    <main>
      <Header />
      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">Group travel, planned together</p>
          <h1>Plan a trip everyone can agree on.</h1>
          <p className="lede">Everyone shares what matters and chooses what stays private. TripSync brings group travel priorities into one clear direction.</p>
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
          <SectionIntro marker="01 · PRODUCT OVERVIEW" title="A coordination layer for group travel." text="TripSync is not another one-click itinerary generator. It is designed to help a group surface real constraints, work through conflicting preferences, and confirm one shared version." />
          <div className="innovation-grid">
            {[
              ["Private input, shared outcome", "Members can express budgets and concerns honestly without making every detail public."],
              ["Constraint-first coordination", "Confirmed hard limits are treated as planning boundaries—not optional suggestions."],
              ["Version-specific consensus", "A rating guides revision. Only explicit acceptance confirms the exact version."],
              ["Explainable revision", "The system preserves accepted parts and explains what changed, why, and whose needs remain unresolved."],
            ].map(([title, text], index) => (
              <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>
            ))}
          </div>
          <div className="section-link"><Link href="#process">See how the product works →</Link></div>
        </div>
      </section>

      <section className="section shell problem" id="why">
        <p className="eyebrow">02 · PEOPLE & THE PROBLEM</p>
        <div className="audience-heading"><h2>Built for trips with more than one voice.</h2><p>Friends, couples, and families bring different relationships to the same planning challenge.</p></div>
        <div className="audience-strip">
          {[["Friends", "Different budgets, interests, and travel rhythms."], ["Couples", "Shared decisions without one person carrying the plan."], ["Families", "Accessibility, energy levels, and personal budget shares."]].map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
        <div className="problem-subsection">
          <p className="eyebrow">THE SHARED PROBLEM</p>
          <h3>Group trips shouldn’t require hundreds of messages.</h3>
          <p>Different priorities are normal. The problem is that group chats rarely turn those priorities into clear constraints, traceable decisions, and one version everyone has actually accepted.</p>
        </div>
        <div className="quote-grid">
          {["“I need to stay under $1,500.”", "“I want to see as much as possible.”", "“I can’t walk for long periods.”", "“I’d rather keep my budget private.”"].map((quote, i) => (
            <article className={`quote-card tone-${i + 1}`} key={quote}><span>Traveler 0{i + 1}</span><p>{quote}</p></article>
          ))}
        </div>
      </section>

      <section className="section process" id="process">
        <div className="shell">
          <SectionIntro marker="03 · HOW IT WORKS" title="From different opinions to one shared plan." text="Five clear stages keep feedback and final acceptance separate." />
          <div className="step-list">
            {steps.map(([number, title, text]) => (
              <article className="step" key={number}>
                <span className="step-number">{number}</span><h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
          <div className="section-link"><Link href="/how-it-works">Explore the full process →</Link></div>
        </div>
      </section>

      <section className="section shell demo-section">
        <SectionIntro marker="04 · PRODUCT PREVIEW" title="See the idea before the full product is built." text="This structured placeholder reserves space for a future product walkthrough without implying that live travel data is already connected." />
        <DemoPanel />
      </section>

      <section className="final-cta">
        <div className="shell">
          <p className="eyebrow">READY WHEN YOUR GROUP IS</p>
          <h2>Your group already has opinions. Bring them into one plan.</h2>
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
