import Link from "next/link";
import { Footer, Header } from "../page";
import Responsibilities from "./Responsibilities";

const flow = [
  ["01", "Create", "The organizer adds the trip basics and shares one invitation link.", "Create-trip form and invitation link"],
  ["02", "Share", "Guests submit dates, budgets, must-haves, and preferences. Each item gets its own visibility setting.", "Guest preference input and AI preference assistant"],
  ["03", "Generate", "AI proposes one plan. The backend checks required conditions, maximum budgets, and available dates.", "Generated plan with deterministic validation status"],
  ["04", "Review", "The organizer verifies real-world facts. Members accept, suggest, or request a change on a specific section.", "Section-level feedback and acceptance controls"],
  ["05", "Publish", "AI makes targeted revisions. A new version is published only after the backend validates the complete plan.", "Validated version history and final publication"],
];

export default function HowItWorks() {
  return <main className="how-page-main"><Header />
    <section className="subhero shell"><p className="eyebrow">HOW TRIPSYNC WORKS</p><h1>Different needs.<br />One shared plan.</h1><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="flow shell">
      {flow.map(([n,title,text,image]) => <article className="flow-step" id={title.toLowerCase()} key={n}><div className="flow-copy"><span>{n}</span><h2>{title}</h2><p>{text}</p></div><div className={`image-placeholder flow-image tone-${((Number(n)-1)%4)+1}`}><span>UI PLACEHOLDER</span><strong>{image}</strong><small>Replace with the corresponding product screen</small></div></article>)}
    </section>
    <Responsibilities />
    <section className="final-cta"><div className="shell"><p className="eyebrow">START TOGETHER</p><h2>Bring every voice into the plan.</h2><Link className="button light" href="/signup?next=/trips/new">Create a trip</Link></div></section><Footer />
  </main>;
}
