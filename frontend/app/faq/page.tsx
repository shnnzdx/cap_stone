import Link from "next/link";
import { Footer, Header } from "../page";

const questions = [
  ["Can other travelers see my budget?", "Only if you choose to share it. A private budget can inform planning without showing its amount or owner to the group."],
  ["What happens when two preferences conflict?", "TripSync identifies the conflict without exposing private details, then suggests compromises, optional activities, or clear planning directions."],
  ["Will AI change a locked destination?", "No. AI may suggest destinations only before the group locks one. Once locked, planning stays within that decision."],
  ["Does everyone have to approve the plan?", "Yes. Satisfaction ratings help improve a plan, but it is finalized only when every active member explicitly accepts the same version."],
  ["Can one person upgrade a flight or room?", "Yes, when the upgrade does not change the shared schedule, reduce another member’s experience, or increase anyone else’s cost."],
  ["Are prices and availability guaranteed?", "Not yet. Early plans may include estimates, which are clearly labeled and should be verified before booking."],
  ["Is TripSync free?", "Yes. TripSync is currently planned as a free product."],
];

export default function FAQ() {
  return <main><Header />
    <section className="subhero shell"><p className="eyebrow">FAQ</p><h1>Know before.<br />Plan together.</h1><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="faq-page shell"><div className="faq-list">{questions.map(([question,answer])=><details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div><aside><p className="eyebrow">STILL CURIOUS?</p><h2>See the complete planning flow.</h2><Link className="button ghost" href="/how-it-works">How It Works</Link></aside></section>
    <Footer />
  </main>;
}
