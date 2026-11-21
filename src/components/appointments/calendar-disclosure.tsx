"use client";

import { useId, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";

export function CalendarDisclosure({ children }: { children: ReactNode }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rdv-calendar-toggle" data-expanded={expanded}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
      >
        <CalendarDays size={18} />{" "}
        {expanded ? "Masquer le calendrier" : "Afficher le calendrier"}{" "}
        <ChevronDown size={18} />
      </button>
      <div id={id} className="rdv-calendar-content">
        {children}
      </div>
    </div>
  );
}
