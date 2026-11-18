export function DashboardHeading({
  title,
  description,
  section,
  children,
  clinician = false,
}: {
  title: string;
  description: string;
  section?: string;
  children?: React.ReactNode;
  clinician?: boolean;
}) {
  return (
    <section className="dashboard-page-heading" data-section={section}>
      <div className="dashboard-heading-copy">
        <span className="eyebrow">
          {clinician ? "Espace soignant" : "Espace parent"}
        </span>
        <h1 id="main-content" tabIndex={-1}>
          {title}
        </h1>
        <p className="muted">{description}</p>
        {children && (
          <div className="dashboard-heading-actions">{children}</div>
        )}
      </div>
    </section>
  );
}
