import logoUrl from "../assets/alert-triage-engine-logo.png";

export function Navigation({ current = "overview" }: { current?: "overview" | "dashboard" | "alerts" | "evaluation" | "admin" }) {
  const links = [
    ["overview", "Overview", "#top"],
    ["dashboard", "Dashboard", "#dashboard"],
    ["alerts", "Alerts", "#alerts"],
    ["evaluation", "Evaluation", "#evaluation"],
    ["admin", "Admin", "#admin"],
  ] as const;

  return (
    <nav className="navigation" aria-label="Primary navigation">
      <a className="nav-brand nav-logo" href="#top" aria-label="Return to Overview">
        <img src={logoUrl} alt="Alert Triage Engine" />
      </a>
      <div className="nav-links">
        {links.map(([key, label, href]) => (
          <a aria-current={key === current ? "page" : undefined} href={href} key={href}>
            {label}
          </a>
        ))}
      </div>
      <a className="nav-action" href="#alerts">
        Review Alerts
      </a>
    </nav>
  );
}
