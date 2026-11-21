"use client";

import { Check, ChevronDown, X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";

const sheetQuery = "(max-width: 700px)";
function subscribeToViewport(notify: () => void) {
  const viewport = window.matchMedia(sheetQuery);
  viewport.addEventListener("change", notify);
  return () => viewport.removeEventListener("change", notify);
}
const clientPresentation = () =>
  window.matchMedia(sheetQuery).matches ? "sheet" : "popover";
const serverPresentation = () => "native";

export type FilterOption = { value: string; label: string };

export function RegistryFilterSelect({
  name,
  label,
  defaultValue,
  options,
  onValueChange,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: readonly FilterOption[];
  onValueChange?: (value: string) => void;
}) {
  const fieldId = useId();
  const labelId = fieldId + "-label";
  const valueId = fieldId + "-value";
  const dialogId = fieldId + "-dialog";
  const listId = fieldId + "-list";
  const titleId = fieldId + "-title";
  const presentation = useSyncExternalStore<string>(
    subscribeToViewport,
    clientPresentation,
    serverPresentation,
  );
  const sheet = presentation === "sheet";
  const [selected, setSelected] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === defaultValue),
    ),
  );
  const [active, setActive] = useState(selected);
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);

  function dismiss(restoreFocus = false) {
    if (!dialog.current?.open) return;
    gesture.current = null;
    dialog.current.close();
    setOpen(false);
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!sheet && !field.current?.contains(event.target as Node)) dismiss();
    }
    function resize() {
      dismiss();
    }
    document.addEventListener("pointerdown", outside);
    const viewport = window.matchMedia(sheetQuery);
    viewport.addEventListener("change", resize);
    if (!sheet) window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      viewport.removeEventListener("change", resize);
      window.removeEventListener("resize", resize);
    };
  }, [open, sheet]);

  function move(index: number) {
    setActive(index);
    list.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }

  function show() {
    const panel = dialog.current;
    const button = trigger.current;
    const wrapper = field.current;
    if (!panel || !button || !wrapper || panel.open) return;
    if (sheet) {
      panel.showModal();
    } else {
      const anchor = button.getBoundingClientRect();
      const below = window.innerHeight - anchor.bottom;
      const above = wrapper.getBoundingClientRect().top;
      const opensUp = below < 260 && above > below;
      panel.dataset.placement = opensUp ? "above" : "below";
      panel.style.setProperty(
        "--filter-room",
        `${Math.max(48, (opensUp ? above : below) - 16)}px`,
      );
      panel.show();
    }
    setOpen(true);
    list.current?.focus({ preventScroll: true });
    move(selected);
  }

  function choose(index: number) {
    setSelected(index);
    dismiss(true);
    onValueChange?.(options[index].value);
  }

  function listKey(event: KeyboardEvent<HTMLDivElement>) {
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = Math.min(active + 1, options.length - 1);
        break;
      case "ArrowUp":
        next = Math.max(active - 1, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = options.length - 1;
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        choose(active);
        return;
      default:
        return;
    }
    event.preventDefault();
    move(next);
  }

  if (presentation === "native") {
    return (
      <label htmlFor={fieldId}>
        {label}
        <select
          id={fieldId}
          name={name}
          defaultValue={options[selected].value}
          onChange={(event) => {
            setSelected(event.currentTarget.selectedIndex);
            onValueChange?.(event.currentTarget.value);
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div
      className="registry-filter-select"
      ref={field}
      onBlur={(event) => {
        if (!sheet && !event.currentTarget.contains(event.relatedTarget))
          dismiss();
      }}
    >
      <span id={labelId} className="registry-filter-label">
        {label}
      </span>
      <input type="hidden" name={name} value={options[selected].value} />
      <button
        type="button"
        className="registry-filter-trigger"
        ref={trigger}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => (open ? dismiss(true) : show())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            show();
          }
          if (event.key === "Escape" && open) {
            event.preventDefault();
            dismiss(true);
          }
        }}
      >
        <span id={valueId}>{options[selected].label}</span>
        <ChevronDown size={19} aria-hidden="true" />
      </button>
      <dialog
        className="registry-filter-dialog"
        data-presentation={presentation}
        id={dialogId}
        ref={dialog}
        aria-labelledby={sheet ? titleId : labelId}
        onCancel={(event) => {
          event.preventDefault();
          dismiss(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dismiss(true);
          }
        }}
        onClick={(event) => {
          if (!sheet || event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX >= bounds.right ||
            event.clientY < bounds.top ||
            event.clientY >= bounds.bottom
          )
            dismiss(true);
        }}
        onTouchStart={(event) => {
          if (!sheet || event.touches.length !== 1 || list.current?.scrollTop)
            return;
          const touch = event.touches[0];
          gesture.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchCancel={() => {
          gesture.current = null;
        }}
        onTouchEnd={(event) => {
          const start = gesture.current;
          gesture.current = null;
          if (!start || list.current?.scrollTop) return;
          const touch = event.changedTouches[0];
          const down = touch.clientY - start.y;
          if (down > 60 && down > Math.abs(touch.clientX - start.x))
            dismiss(true);
        }}
      >
        {sheet && (
          <div className="registry-filter-sheet-heading">
            <span className="registry-filter-grip" aria-hidden="true" />
            <h2 id={titleId}>{label}</h2>
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => dismiss(true)}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        )}
        <div
          className="registry-filter-options"
          id={listId}
          ref={list}
          role="listbox"
          tabIndex={0}
          aria-labelledby={sheet ? titleId : labelId}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={listKey}
        >
          {options.map((option, index) => (
            <div
              className="registry-filter-option"
              id={`${listId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={index === selected}
              data-active={index === active ? "" : undefined}
              onClick={() => choose(index)}
            >
              {option.label}
              {index === selected && <Check size={19} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
