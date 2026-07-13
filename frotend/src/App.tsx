import { useEffect, useState } from "react";
import { HeroSection } from "./components/HeroSection";
import { AlertReviewProvider } from "./simulation/alertReviewStore";
import { AlertsPage } from "./pages/AlertsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvaluationPage } from "./pages/EvaluationPage";

const routeCards = [
  {
    id: "dashboard",
    label: "Dashboard",
    title: "Monitor alert quality and backend job health.",
    body: "Track alert volume, suppressed noise, duplicate groups, precision, recall, and active job risk from one operating view.",
  },
  {
    id: "alerts",
    label: "Alerts",
    title: "Review, explain, and label active alerts.",
    body: "Inspect alert details, see why each alert was promoted or suppressed, and submit human feedback labels.",
  },
  {
    id: "evaluation",
    label: "Evaluation",
    title: "Compare adaptive ranking against baselines.",
    body: "Benchmark fixed thresholds, rule-only suppression, and feedback-driven ranking with the same seeded alert stream.",
  },
  {
    id: "admin",
    label: "Admin",
    title: "Approve recommendations before rules change.",
    body: "Manage thresholds, suppression rules, feedback weights, users, roles, and audit history for adaptive decisions.",
  },
];

function AppContent() {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  if (hash === "#dashboard") return <DashboardPage />;

  if (hash === "#alerts" || hash.startsWith("#alerts/")) return <AlertsPage />;

  if (hash === "#evaluation") return <EvaluationPage />;

  return (
    <main>
      <HeroSection />
      <section className="continuation-section" id="overview">
        <p className="eyebrow">Prototype navigation</p>
        <h2>MOVE FROM ALERT NOISE TO REVIEW, FEEDBACK, AND EVALUATION.</h2>
        <div className="route-card-grid" aria-label="Prototype pages">
          {routeCards.map((card) => (
            <article className="route-card" id={card.id} key={card.id}>
              <span>{card.label}</span>
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <a href={`#${card.id}`}>Open {card.label}</a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <AlertReviewProvider>
      <AppContent />
    </AlertReviewProvider>
  );
}
