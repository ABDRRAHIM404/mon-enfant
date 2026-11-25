"use client";

import { CalendarDays } from "lucide-react";
import { useId, useRef } from "react";
import {
  frenchAppointmentDate,
  parseAppointmentDate,
} from "@/lib/appointments/calendar";

export function FrenchDateInput({
  date,
  readOnly,
  min,
  max,
  name = "date",
  label,
  required = true,
}: {
  date?: string;
  readOnly?: boolean;
  min?: string;
  max?: string;
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const id = useId();
  const text = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const field = (
    <input
      id={id}
      ref={text}
      type="text"
      name={name}
      inputMode="numeric"
      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      placeholder="JJ/MM/AAAA"
      title="Format JJ/MM/AAAA"
      defaultValue={date ? frenchAppointmentDate(date) : ""}
      readOnly={readOnly}
      required={required}
      onChange={(event) => {
        const input = event.currentTarget;
        const digits = input.value.replace(/\D/g, "").slice(0, 8);
        input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
          .filter(Boolean)
          .join("/");
        input.setCustomValidity("");
        if (picker.current) picker.current.value = "";
        if (digits.length !== 8) return;
        try {
          const iso = parseAppointmentDate(input.value);
          if (picker.current) picker.current.value = iso;
          if (min && iso < min)
            input.setCustomValidity(
              `Choisissez une date à partir du ${frenchAppointmentDate(min)}.`,
            );
          if (max && iso > max)
            input.setCustomValidity(
              "Choisissez une date qui n’est pas dans le futur.",
            );
        } catch {
          input.setCustomValidity(
            "Indiquez une date valide au format JJ/MM/AAAA.",
          );
        }
      }}
    />
  );
  if (!label) return field;
  return (
    <div className="registration-date-picker">
      <label htmlFor={id}>{label}</label>
      <div>
        {field}
        <label className="registration-calendar">
          <CalendarDays size={19} aria-hidden="true" />
          <input
            ref={picker}
            type="date"
            aria-label="Choisir la date dans le calendrier"
            defaultValue={date}
            min={min}
            max={max}
            onChange={(event) => {
              if (!text.current) return;
              const value = event.currentTarget.value;
              text.current.value = value ? frenchAppointmentDate(value) : "";
              text.current.setCustomValidity(
                event.currentTarget.validationMessage,
              );
            }}
          />
        </label>
      </div>
    </div>
  );
}
