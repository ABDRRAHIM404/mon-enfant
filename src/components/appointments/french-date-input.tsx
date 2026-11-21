"use client";

import {
  frenchAppointmentDate,
  parseAppointmentDate,
} from "@/lib/appointments/calendar";

export function FrenchDateInput({
  date,
  readOnly,
  min,
}: {
  date: string;
  readOnly?: boolean;
  min?: string;
}) {
  return (
    <input
      type="text"
      name="date"
      inputMode="numeric"
      pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
      placeholder="JJ/MM/AAAA"
      title="Format JJ/MM/AAAA"
      defaultValue={frenchAppointmentDate(date)}
      readOnly={readOnly}
      required
      onChange={(event) => {
        const input = event.currentTarget;
        const digits = input.value.replace(/\D/g, "").slice(0, 8);
        input.value = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)]
          .filter(Boolean)
          .join("/");
        input.setCustomValidity("");
        if (digits.length !== 8) return;
        try {
          if (parseAppointmentDate(input.value) < (min ?? ""))
            input.setCustomValidity("Choisissez une date à venir.");
        } catch {
          input.setCustomValidity(
            "Indiquez une date valide au format JJ/MM/AAAA.",
          );
        }
      }}
    />
  );
}
