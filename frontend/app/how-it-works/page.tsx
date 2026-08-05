import Link from "next/link";
import { Footer, Header } from "../site-shell";
import Responsibilities from "./Responsibilities";

const flow = [
  ["01", "Create", "The organizer adds the trip basics and shares one invitation link.", "Shared planning space", "Destination · Dates · Invitation link"],
  ["02", "Share", "Guests submit dates, budgets, must-haves, and preferences. Each item gets its own visibility setting.", "Private preference input", "Dates · Budget · Must-haves · Visibility"],
  ["03", "Generate", "AI proposes one plan. The backend checks required conditions, maximum budgets, and available dates.", "One explainable proposal", "AI draft · Constraint check · Confidence"],
  ["04", "Review", "The organizer verifies real-world facts. Members accept, suggest, or request a change on a specific section.", "Focused group review", "Accept · Suggest · Request a change"],
  ["05", "Publish", "AI makes targeted revisions. A new version is published only after the backend validates the complete plan.", "Validated plan version", "Revised · Rechecked · Ready to publish"],
];

export default function HowItWorks() {
  return <main className="how-page-main"><Header />
    <section className="subhero shell"><p className="eyebrow">HOW TRIPSYNC WORKS</p><h1>Different needs.<br />One shared plan.</h1><p>Five stages move a group from private input to a validated, explainable version.</p><Link className="button dark" href="/signup?next=/trip">Create an account</Link></section>
    <section className="flow shell">
      {flow.map(([n,title,text,image,meta]) => <article className="flow-step" id={title.toLowerCase()} key={n}><div className="flow-copy"><span>{n}</span><h2>{title}</h2><p>{text}</p></div><div className={`flow-image tone-${((Number(n)-1)%4)+1}`}><div className="flow-visual-top"><span>STEP {n}</span><i>↗</i></div><strong>{image}</strong><p>{meta}</p><div className="flow-status"><span>Group input</span><span>TripSync</span><span>Shared plan</span></div></div></article>)}
    </section>
    <Responsibilities />
    <section className="final-cta"><div className="shell"><p className="eyebrow">START TOGETHER</p><h2>Bring every voice into the plan.</h2><Link className="button light" href="/signup?next=/trip">Create an account</Link></div></section><Footer />
  </main>;
}
