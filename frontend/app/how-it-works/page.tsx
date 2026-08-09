import Link from "next/link";
import { Footer, Header } from "../page";
import Responsibilities from "./Responsibilities";
import { planningFlowSteps } from "../../../shared/tripsync-product-content.js";

export default function HowItWorks() {
  return <main className="how-page-main"><Header />
    <section className="subhero shell"><p className="eyebrow">HOW CADENSY WORKS</p><h1>Different needs.<br />One shared plan.</h1><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="flow shell">
      {planningFlowSteps.map((step) => <article className="flow-step" id={step.title.toLowerCase()} key={step.number}><div className="flow-copy"><span>{step.number}</span><h2>{step.title}</h2><p>{step.text}</p></div><div className={`image-placeholder flow-image tone-${((Number(step.number)-1)%4)+1}`}><span>PRODUCT VIEW</span><strong>{step.productView}</strong><small>See what the group sees at this stage</small></div></article>)}
    </section>
    <Responsibilities />
    <section className="final-cta"><div className="shell"><p className="eyebrow">READY TO PLAN TOGETHER</p><h2>Different needs.<br />One shared plan.</h2><Link className="button light" href="/signup?next=/trips/new">Create a trip</Link></div></section><Footer />
  </main>;
}
