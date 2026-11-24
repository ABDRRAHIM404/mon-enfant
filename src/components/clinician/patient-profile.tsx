import type { ReactNode } from "react";

export function ChildPageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="child-page-heading">
      <div>
        <h1 id="main-content" tabIndex={-1}>
          {title}
        </h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="child-page-actions no-print">{actions}</div>}
    </header>
  );
}

export function ChildPanel({
  title,
  children,
  className,
  id,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      className={`child-panel${className ? ` ${className}` : ""}`}
      id={id}
    >
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function ChildStatus({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "green" | "amber" | "red";
  children: ReactNode;
}) {
  return (
    <span className={`child-status child-status--${tone}`}>{children}</span>
  );
}
