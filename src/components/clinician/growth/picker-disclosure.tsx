"use client";

import { ChevronDown, UsersRound } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

export function GrowthPickerDisclosure({
  children,
  hasSelection,
}: {
  children: ReactNode;
  hasSelection: boolean;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(!hasSelection);
  return (
    <div className="growth-picker-disclosure" data-expanded={expanded}>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        className="growth-action"
      >
        <UsersRound size={18} aria-hidden="true" />{" "}
        {hasSelection ? "Changer d’enfant" : "Choisir un enfant"}{" "}
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={id}>{children}</div>
    </div>
  );
}
