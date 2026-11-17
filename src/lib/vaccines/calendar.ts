/** Date-only routine reference arithmetic. This module does not prescribe catch-up dates. */
export type CivilDate = string;
const DAY = 86_400_000;
export function civilDay(value: CivilDate): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-"))
    throw new RangeError("Invalid civil date");
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(time) ||
    new Date(time).toISOString().slice(0, 10) !== value
  )
    throw new RangeError("Invalid civil date");
  return time / DAY;
}
function fromDay(day: number): CivilDate {
  if (!Number.isInteger(day)) throw new RangeError("Invalid civil day");
  const value = new Date(day * DAY).toISOString().slice(0, 10);
  if (!/^\d{4}-/.test(value))
    throw new RangeError("Civil date outside supported range");
  return value;
}
export function addCivilDays(date: CivilDate, days: number): CivilDate {
  if (!Number.isSafeInteger(days))
    throw new RangeError("Integer days required");
  return fromDay(civilDay(date) + days);
}
export function addCalendarMonths(date: CivilDate, months: number): CivilDate {
  civilDay(date);
  if (!Number.isSafeInteger(months))
    throw new RangeError("Integer months required");
  const [year, month, day] = date.split("-").map(Number);
  const index = year * 12 + month - 1 + months;
  const targetYear = Math.floor(index / 12),
    targetMonth = index - targetYear * 12 + 1;
  if (targetYear < 1 || targetYear > 9999)
    throw new RangeError("Civil date outside supported range");
  const first = `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-01`;
  const leap =
    targetYear % 4 === 0 && (targetYear % 100 !== 0 || targetYear % 400 === 0);
  const monthLength = [
    31,
    leap ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][targetMonth - 1];
  return addCivilDays(first, Math.min(day, monthLength) - 1);
}
export function addCalendarYears(date: CivilDate, years: number): CivilDate {
  if (!Number.isSafeInteger(years))
    throw new RangeError("Integer years required");
  return addCalendarMonths(date, years * 12);
}
export type RoutineAge =
  | { unit: "first_4_weeks"; value?: never }
  | { unit: "weeks" | "months" | "years"; value: number };
export type RoutineRule = {
  doseCode: string;
  vaccineCode: string;
  age: RoutineAge;
  eligibility: "all" | "female";
  automaticScheduling: boolean;
};
export type ReferenceState =
  | "unreviewed_version"
  | "disabled_reference_only"
  | "birth_date_uncertain"
  | "eligibility_unknown"
  | "ineligible"
  | "routine_reference";
export type RoutineReference = {
  state: ReferenceState;
  startOn: CivilDate | null;
  endOn: CivilDate | null;
  isWindow: boolean;
};
type RoutineChild = {
  birthDate: CivilDate | null;
  birthPrecision: "exact" | "estimated" | "unknown";
  sex: "female" | "male" | "unknown";
};
export function routineReference(
  rule: RoutineRule,
  child: RoutineChild,
  version: {
    status: "draft" | "approved" | "retired";
    reviewVerified: boolean;
  },
): RoutineReference {
  return calculateRoutineReference(
    rule,
    child,
    version.status === "approved" && version.reviewVerified,
  );
}
/** Read-only provisional preview; never grants approval or assigns clinical references. */
export function routinePreviewReference(
  rule: RoutineRule,
  child: RoutineChild,
): RoutineReference {
  return calculateRoutineReference(rule, child, true);
}
function calculateRoutineReference(
  rule: RoutineRule,
  child: RoutineChild,
  datesEnabled: boolean,
): RoutineReference {
  const empty = (state: ReferenceState): RoutineReference => ({
    state,
    startOn: null,
    endOn: null,
    isWindow: false,
  });
  if (rule.doseCode === "HB1" || !rule.automaticScheduling)
    return empty("disabled_reference_only");
  if (
    rule.doseCode === "HPV" &&
    (rule.age.unit !== "years" ||
      rule.age.value !== 11 ||
      rule.eligibility !== "female")
  )
    throw new RangeError("Invalid agreed HPV rule");
  const rotaMonth: Record<string, number> = { Rota1: 2, Rota2: 3, Rota3: 4 };
  if (
    rotaMonth[rule.doseCode] &&
    (rule.age.unit !== "months" || rule.age.value !== rotaMonth[rule.doseCode])
  )
    throw new RangeError("Invalid agreed rotavirus rule");
  if (!["first_4_weeks", "weeks", "months", "years"].includes(rule.age.unit))
    throw new RangeError("Invalid routine age unit");
  if (!datesEnabled) return empty("unreviewed_version");
  if (rule.eligibility === "female" && child.sex === "unknown")
    return empty("eligibility_unknown");
  if (rule.eligibility === "female" && child.sex !== "female")
    return empty("ineligible");
  if (child.birthPrecision !== "exact" || !child.birthDate)
    return empty("birth_date_uncertain");
  civilDay(child.birthDate);
  if (rule.age.unit === "first_4_weeks")
    return {
      state: "routine_reference",
      startOn: child.birthDate,
      endOn: addCivilDays(child.birthDate, 27),
      isWindow: true,
    };
  if (
    !Number.isSafeInteger(rule.age.value) ||
    rule.age.value < 1 ||
    rule.age.value > 1040
  )
    throw new RangeError("Invalid routine age");
  const startOn =
    rule.age.unit === "weeks"
      ? addCivilDays(child.birthDate, rule.age.value * 7)
      : rule.age.unit === "months"
        ? addCalendarMonths(child.birthDate, rule.age.value)
        : addCalendarYears(child.birthDate, rule.age.value);
  return {
    state: "routine_reference",
    startOn,
    endOn: startOn,
    isWindow: false,
  };
}
