import Link from "next/link";
import { Footer, Header } from "../page";

const flow = [
  ["01", "Create", "Set the destination, dates, and confirmed trip details. Invite every active traveler with one link.", "Create-trip form and invitation link"],
  ["02", "Share", "Each person shares what matters and chooses what stays private. AI-organized information is confirmed by the traveler.", "Natural-language input becoming confirmed preference cards"],
  ["03", "Generate", "TripSync identifies conflicts and proposes a plan around confirmed hard constraints and group preferences.", "Constraint summary and proposed itinerary interface"],
  ["04", "Review", "Members rate the version and explain what should stay or change. Ratings guide improvement; they do not approve the trip.", "Satisfaction rating and feedback interface"],
  ["05", "Agree", "The plan locks only when every active member explicitly accepts the same version.", "Member acceptance status and locked-plan interface"],
];

export default function HowItWorks() {
  return <main><Header />
    <section className="subhero shell"><p className="eyebrow">HOW TRIPSYNC WORKS</p><h1>Different needs.<br/>One shared plan.</h1><p>Five clear stages move a group from an idea to one accepted version—without confusing satisfaction with final approval.</p><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="flow shell">
      {flow.map(([n,title,text,image], i) => <article className="flow-step" id={title.toLowerCase()} key={n}><div className="flow-copy"><span>{n}</span><h2>{title}</h2><p>{text}</p>{i===3 && <div className="logic-note"><strong>Rating ≠ Acceptance</strong><p>A high rating can still include a required change.</p></div>}</div><div className={`image-placeholder flow-image tone-${(i%4)+1}`}><span>UI PLACEHOLDER</span><strong>{image}</strong><small>Replace with the corresponding product screen</small></div></article>)}
    </section>
    <section className="compare shell"><p className="eyebrow">THE IMPORTANT DIFFERENCE</p><h2>Rating a plan is not the same as accepting it.</h2><div className="compare-grid"><article><span>01</span><h3>Satisfaction rating</h3><strong>4 / 5</strong><p>Helps AI understand what works, what should change, and which parts should be preserved.</p></article><article className="accepted"><span>02</span><h3>Acceptance</h3><strong>Accept this version</strong><p>Confirms that this exact version works for the member. No response is never treated as approval.</p></article></div></section>
    <section className="final-cta"><div className="shell"><p className="eyebrow">START TOGETHER</p><h2>Bring every voice into the plan.</h2><Link className="button light" href="/signup?next=/trips/new">Create a trip</Link></div></section><Footer />
  </main>;
}
