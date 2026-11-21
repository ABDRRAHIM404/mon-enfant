import {
  addCivilDays,
  addCalendarMonths,
  civilDay,
} from "../vaccines/calendar";
export const appointmentZone = "Africa/Casablanca";
export type CalendarView = "day" | "week" | "month";
function parts(date: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: appointmentZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
export function todayCasablanca(now = new Date()) {
  return parts(now).slice(0, 10);
}
export function localAppointmentInput(instant: string) {
  return parts(new Date(instant));
}
export function localAppointmentOffset(instant: string) {
  const local = localAppointmentInput(instant);
  return (
    ["+01:00", "+00:00"].find(
      (offset) => Date.parse(`${local}:00${offset}`) === Date.parse(instant),
    ) ?? "auto"
  );
}
export function resolveAppointmentTime(local: string, offset = "auto") {
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(local))
    throw new RangeError("Indiquez une date et une heure locales valides.");
  civilDay(local.slice(0, 10));
  const choices = ["+01:00", "+00:00"].filter(
    (choice) => parts(new Date(`${local}:00${choice}`)) === local,
  );
  if (!choices.length)
    throw new RangeError(
      "Cette heure n’existe pas à Casablanca lors du changement d’heure. Choisissez une autre heure.",
    );
  if (offset !== "auto") {
    if (!choices.includes(offset))
      throw new RangeError(
        "Le décalage choisi ne correspond pas à cette heure à Casablanca.",
      );
    return `${local}:00${offset}`;
  }
  if (choices.length !== 1)
    throw new RangeError(
      "Cette heure se répète lors du changement d’heure. Choisissez explicitement UTC+1 ou UTC+0 pour ce créneau.",
    );
  return `${local}:00${choices[0]}`;
}
export function calendarRange(anchor: string, view: CalendarView) {
  civilDay(anchor);
  const weekday = (date: string) =>
    (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  let from = anchor,
    to = anchor,
    previous = addCivilDays(anchor, -1),
    next = addCivilDays(anchor, 1);
  if (view === "week") {
    from = addCivilDays(anchor, -weekday(anchor));
    to = addCivilDays(from, 6);
    previous = addCivilDays(anchor, -7);
    next = addCivilDays(anchor, 7);
  } else if (view === "month") {
    const first = anchor.slice(0, 7) + "-01",
      last = addCivilDays(addCalendarMonths(first, 1), -1);
    from = addCivilDays(first, -weekday(first));
    to = addCivilDays(last, 6 - weekday(last));
    previous = addCalendarMonths(first, -1);
    next = addCalendarMonths(first, 1);
  }
  const days = [];
  for (let date = from; date <= to; date = addCivilDays(date, 1))
    days.push(date);
  return { from, to, previous, next, days };
}
export function appointmentTime(instant: string) {
  return new Intl.DateTimeFormat("fr-MA", {
    timeZone: appointmentZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "shortOffset",
  }).format(new Date(instant));
}

export function parseAppointmentDate(value: string): string {
  const french = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  const iso = french ? `${french[3]}-${french[2]}-${french[1]}` : value;
  try {
    civilDay(iso);
  } catch {
    throw new RangeError("Indiquez une date valide au format JJ/MM/AAAA.");
  }
  return iso;
}

export function frenchAppointmentDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function appointmentWorkspaceRange(anchor: string, view: CalendarView) {
  const calendar = calendarRange(anchor, "month");
  const month = anchor.slice(0, 7) + "-01";
  const monthEnd = addCivilDays(calendar.next, -1);
  const period =
    view === "month"
      ? { from: month, to: monthEnd }
      : calendarRange(anchor, view);
  return { month, calendar, period };
}

const readableDate = new Intl.DateTimeFormat("fr-MA", {
  dateStyle: "long",
  timeZone: "UTC",
});
export function readableAppointmentDate(iso: string): string {
  return readableDate.format(new Date(`${iso}T12:00:00Z`));
}
