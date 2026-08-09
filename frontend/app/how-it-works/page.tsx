import Link from "next/link";
import { Footer, Header } from "../page";
import Responsibilities from "./Responsibilities";

const flow = [
  ["01", "Create", "Add a destination and date range, then bring everyone in with one link.", "Create a trip and share one invitation link"],
  ["02", "Share", "Each traveler adds preferences, hard limits, and private needs with a visibility choice for every item.", "Private input and visibility controls"],
  ["03", "Build", "AI drafts a complete itinerary. Fixed rules check dates, budgets, and must-haves before it goes live.", "A complete draft with validated hard limits"],
  ["04", "Decide", "Anyone can suggest a change. CADENSY checks hard limits and decision history before the plan moves.", "A change routed to Notice, Round, or Confirm"],
  ["05", "Adapt", "The Current Plan updates without rebuilding what already works, while every decision stays traceable.", "A living plan with a clear decision history"],
];

export default function HowItWorks() {
  return <main className="how-page-main"><Header />
    <section className="subhero shell"><p className="eyebrow">HOW CADENSY WORKS</p><h1>Different needs.<br />One shared plan.</h1><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="flow shell">
      {flow.map(([n,title,text,image]) => <article className="flow-step" id={title.toLowerCase()} key={n}><div className="flow-copy"><span>{n}</span><h2>{title}</h2><p>{text}</p></div><div className={`image-placeholder flow-image tone-${((Number(n)-1)%4)+1}`}><span>PRODUCT VIEW</span><strong>{image}</strong><small>See what the group sees at this stage</small></div></article>)}
    </section>
    <Responsibilities />
    <section className="final-cta"><div className="shell"><p className="eyebrow">READY TO PLAN TOGETHER</p><h2>Different needs.<br />One shared plan.</h2><Link className="button light" href="/signup?next=/trips/new">Create a trip</Link></div></section><Footer />
  </main>;
}
