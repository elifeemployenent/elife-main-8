export interface AttendanceEntry {
  agent_id: string;
  name: string;
  role: string;
  ward: string | null;
  panchayath_name: string | null;
  check_in_at: string | null;
}

export interface AttendanceSummary {
  totalAgents: number;
  present: number;
  absent: number;
}

export interface OfficeAudienceAgent {
  id: string;
  name: string;
  role: string;
  ward: string | null;
  panchayath_name: string | null;
}

export interface OfficeAudienceSeenRecord {
  agent_id: string;
  seen_at: string;
}

export interface OfficeAudienceRow extends OfficeAudienceAgent {
  seen_at: string | null;
}

export function getIndiaDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getAttendanceSummary(entries: AttendanceEntry[]): AttendanceSummary {
  const present = entries.filter((entry) => entry.check_in_at !== null).length;
  return {
    totalAgents: entries.length,
    present,
    absent: entries.length - present,
  };
}

export function splitOfficeAudience(
  agents: OfficeAudienceAgent[],
  seenRecords: OfficeAudienceSeenRecord[],
): { seen: OfficeAudienceRow[]; pending: OfficeAudienceRow[] } {
  const seenAtByAgent = new Map(seenRecords.map((record) => [record.agent_id, record.seen_at]));
  const seen: OfficeAudienceRow[] = [];
  const pending: OfficeAudienceRow[] = [];

  for (const agent of agents) {
    const seenAt = seenAtByAgent.get(agent.id) ?? null;
    const row = { ...agent, seen_at: seenAt };
    (seenAt ? seen : pending).push(row);
  }

  return { seen, pending };
}