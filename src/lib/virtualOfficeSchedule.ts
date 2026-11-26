export const ATTENDANCE_START_MINUTE = 10 * 60;
export const ATTENDANCE_END_MINUTE = 12 * 60;
export const VIRTUAL_OFFICE_TIME_ZONE = "Asia/Kolkata";

export type AttendanceWindowState = "before" | "open" | "closed";

export function getIndiaLocalMinute(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIRTUAL_OFFICE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function getAttendanceWindowState(date: Date): AttendanceWindowState {
  const minute = getIndiaLocalMinute(date);
  if (minute < ATTENDANCE_START_MINUTE) return "before";
  if (minute < ATTENDANCE_END_MINUTE) return "open";
  return "closed";
}

export function formatIndiaTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: VIRTUAL_OFFICE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}