"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

export function SidebarToggle({ controls }: { controls: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <button
      className="sidebar-toggle"
      type="button"
      aria-controls={controls}
      aria-pressed={collapsed}
      aria-label="Réduire la navigation"
      title={collapsed ? "Développer la navigation" : "Réduire la navigation"}
      onClick={() => setCollapsed(!collapsed)}
    >
      <Icon size={19} aria-hidden="true" />
    </button>
  );
}
