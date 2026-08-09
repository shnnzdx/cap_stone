import Link from "next/link";
import { Footer, Header } from "../page";

const questions = [
  ["Can other travelers see my budget?", "Only if you choose to share it. A private budget can shape the Current Plan without showing its amount, wording, or owner to the group."],
  ["What happens when two needs conflict?", "CADENSY protects confirmed hard limits first, then helps the group compare trade-offs and choose a workable direction without exposing private details."],
  ["Can AI change the Current Plan?", "AI can draft plans, explain trade-offs, and suggest alternatives. Fixed rules decide how a change is routed, so AI cannot bypass a hard limit or settled choice."],
  ["Does everyone approve every change?", "No. Open changes can apply with a notice, contested choices open a round, and only travelers affected by a hard-limit change must confirm it."],
  ["Can the organizer decide for someone else?", "No. The organizer has no extra decision weight, cannot view planning-system-only input, and cannot confirm another traveler's needs or choices."],
  ["Are prices and availability guaranteed?", "Not yet. Early plans may include estimates, which are clearly labeled and should be verified before booking."],
  ["Is CADENSY free?", "Yes. CADENSY is currently free to use while the product is being developed."],
];

export default function FAQ() {
  return <main><Header />
    <section className="subhero shell"><p className="eyebrow">FAQ</p><h1>Clear rules.<br />Plan together.</h1><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="faq-page shell"><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div><aside><p className="eyebrow">SEE IT IN ACTION</p><h2>Follow the complete planning flow.</h2><Link className="button ghost" href="/how-it-works">How It Works</Link></aside></section>
    <Footer />
  </main>;
}
