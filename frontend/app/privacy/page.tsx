import Link from "next/link";
import { Footer, Header } from "../page";

export default function Privacy() {
  return <main><Header />
    <section className="subhero shell"><p className="eyebrow">PRODUCT PRIVACY</p><h1>Share on your terms.</h1><p>Choose what the group sees while TripSync keeps every constraint useful.</p><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="visibility shell"><div className="section-intro"><p className="eyebrow">01 · VISIBILITY</p><div><h2>One preference, three ways to share.</h2><p>Visibility is selected for each individual item, rather than applied to every detail at once.</p></div></div><div className="visibility-grid">{[["Only AI", "Used during planning without showing the detail or its owner to the group."], ["Group summary", "The group sees a general planning need without the private detail."], ["Shared with the group", "The full preference is visible to other trip members."]].map(([t,p],i)=><article className={`tone-${i+1}`} key={t}><span>0{i+1}</span><h3>{t}</h3><p>{p}</p></article>)}</div></section>
    <section className="privacy-example"><div className="shell"><p className="eyebrow">02 · FROM PRIVATE TO USEFUL</p><h2>Use the constraint. Protect the person.</h2><div className="privacy-pair"><div><span>ONLY AI</span><p>“My maximum budget is $1,500.”</p></div><i>→</i><div><span>GROUP SUMMARY</span><p>“The current option exceeds at least one traveler’s budget.”</p></div></div></div></section>
    <section className="section shell"><div className="section-intro"><p className="eyebrow">03 · PRODUCT VIEW</p><div><h2>Show the rule in context.</h2><p>This space is reserved for a real privacy-control screen once the product interface is available.</p></div></div><div className="image-placeholder wide"><span>UI PLACEHOLDER</span><strong>Preference visibility controls</strong><small>Only AI · Group summary · Shared with the group</small></div></section>
    <section className="final-cta"><div className="shell"><p className="eyebrow">HONEST INPUT, SHARED DIRECTION</p><h2>Create room for what every traveler needs.</h2><Link className="button light" href="/signup?next=/trips/new">Create a trip</Link></div></section><Footer />
  </main>;
}
