"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type SearchOption = { value: string; label: string; detail?: string };
const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr");
export function SearchSelect({
  label,
  name,
  options,
  value,
  onChange,
  required = false,
  help,
}: {
  label: string;
  name: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  help?: string;
}) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    left: 8,
    top: 8,
    width: 240,
    maxHeight: 280,
  });
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter(
    (o) =>
      o.value === "other" ||
      fold(`${o.label} ${o.detail ?? ""}`).includes(fold(query)),
  );
  const index = Math.min(active, Math.max(0, filtered.length - 1));
  useEffect(() => {
    input.current?.setCustomValidity(
      required && !selected ? "Choisissez une option dans la liste." : "",
    );
  }, [required, selected]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = input.current?.getBoundingClientRect();
      if (!box) return;
      const viewport = window.visualViewport;
      const floor =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight);
      const ceiling = viewport?.offsetTop ?? 0;
      const below = floor - box.bottom - 12,
        above = box.top - ceiling - 12;
      const up = below < 160 && above > below;
      const height = Math.max(48, Math.min(280, up ? above : below));
      setPosition({
        left: Math.max(
          8,
          Math.min(
            box.left,
            innerWidth - Math.min(box.width, innerWidth - 16) - 8,
          ),
        ),
        top: up ? Math.max(ceiling + 8, box.top - height - 4) : box.bottom + 4,
        width: Math.min(box.width, innerWidth - 16),
        maxHeight: height,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.visualViewport?.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.visualViewport?.removeEventListener("resize", place);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${index}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, index, id]);
  const choose = (option: SearchOption) => {
    onChange(option.value);
    setQuery("");
    setOpen(false);
    input.current?.focus();
  };
  return (
    <div className="smart-field">
      <label htmlFor={id}>
        {label}
        {required ? " (obligatoire)" : ""}
      </label>
      <div className="smart-input-wrap">
        <input
          id={id}
          ref={input}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={
            open && filtered[index] ? `${id}-option-${index}` : undefined
          }
          aria-describedby={help ? `${id}-help` : undefined}
          aria-required={required}
          autoComplete="off"
          spellCheck={false}
          required={required}
          value={open ? query : (selected?.label ?? "")}
          placeholder="Rechercher ou choisir…"
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onBlur={(e) => {
            if (!menu.current?.contains(e.relatedTarget)) {
              setOpen(false);
              setQuery("");
            }
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive(
                open
                  ? (index +
                      (e.key === "ArrowDown" ? 1 : filtered.length - 1)) %
                      Math.max(1, filtered.length)
                  : 0,
              );
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              if (filtered[index]) choose(filtered[index]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setQuery("");
            } else if (e.key === "Tab") {
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <span className="smart-chevron" aria-hidden="true">
          ⌄
        </span>
      </div>
      <input type="hidden" name={name} value={selected?.value ?? ""} />
      {help && (
        <p id={`${id}-help`} className="fine">
          {help}
        </p>
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            className="smart-options"
            style={{ position: "fixed", ...position }}
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
          >
            {!filtered.length && (
              <p role="status">Aucun résultat. Modifiez la recherche.</p>
            )}
            {filtered.map((o, i) => (
              <div
                id={`${id}-option-${i}`}
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={
                  i === index ? "smart-option is-focused" : "smart-option"
                }
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <span>
                  <strong>{o.label}</strong>
                  {o.detail && <small>{o.detail}</small>}
                </span>
                <span aria-hidden="true">{o.value === value ? "✓" : ""}</span>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
