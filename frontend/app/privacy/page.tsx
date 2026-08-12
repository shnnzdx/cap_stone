import Link from "next/link";
import { Footer, Header } from "../page";

export default function Privacy() {
  const levels = [
    ["Planning system only", "Your input can shape the plan without showing its original wording or owner to the organizer or group."],
    ["Organizer", "You can choose to show an item to the organizer. This is your choice, not an extra permission attached to their role."],
    ["Everyone", "Share an item with the whole group when seeing the original detail helps everyone decide together."],
  ];
  return <main className="privacy-page-main"><Header />
    <section className="subhero shell"><p className="eyebrow">PRIVACY BY CHOICE</p><h1>Your needs.<br />Your visibility.</h1><Link className="button dark" href="/signup?next=/trips/new">Create a trip</Link></section>
    <section className="visibility shell"><div className="section-intro"><p className="eyebrow">01 · VISIBILITY</p><div><h2>Set visibility.</h2></div></div><div className="visibility-grid">{levels.map(([title, copy], index) => <article className={`tone-${index + 1}`} key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p></article>)}</div><p className="privacy-disclosure">Planning system only is a product visibility setting, not a guarantee of complete anonymity. In a small group, others may still infer who a constraint belongs to. Authorized operations staff may also process data when required for security, support, or legal obligations.</p></section>
    <section className="privacy-example"><div className="shell"><p className="eyebrow">02 · PRIVATE INPUT, GROUP RESULT</p><h2>Protect the detail.<br />Keep the limit.</h2><div className="privacy-pair"><div><span>PLANNING SYSTEM ONLY</span><p>"My total budget cannot exceed $800."</p></div><i>→</i><div><span>CURRENT PLAN</span><p>"This option exceeds one traveler's confirmed budget limit."</p></div></div></div></section>
    <section className="final-cta" data-header-theme="dark"><div className="shell"><p className="eyebrow">READY TO PLAN TOGETHER</p><h2>Different needs.<br />One shared plan.</h2><Link className="button light" href="/signup?next=/trips/new">Create a trip</Link></div></section><Footer />
  </main>;
}
