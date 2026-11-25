export interface VirtualOfficeAnnouncementInput {
  panchayathId: string;
  title: string;
  body: string;
}

export type VirtualOfficeAnnouncementValidation =
  | { valid: true; value: VirtualOfficeAnnouncementInput }
  | { valid: false; error: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateVirtualOfficeAnnouncementInput(input: unknown): VirtualOfficeAnnouncementValidation {
  if (typeof input !== "object" || input === null) {
    return { valid: false, error: "Announcement details are required." };
  }

  const data = input as Record<string, unknown>;
  const panchayathId = typeof data.panchayath_id === "string" ? data.panchayath_id.trim() : "";
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const body = typeof data.body === "string" ? data.body.trim() : "";

  if (!UUID_PATTERN.test(panchayathId)) return { valid: false, error: "Choose a valid Panchayath." };
  if (!title || title.length > 120) return { valid: false, error: "Title must be 1–120 characters." };
  if (!body || body.length > 3000) return { valid: false, error: "Announcement must be 1–3000 characters." };

  return { valid: true, value: { panchayathId, title, body } };
}

export function canPublishVirtualOfficeAnnouncement(
  agentId: string,
  assignedManagerId: string | null,
  isActive: boolean,
): boolean {
  return isActive && assignedManagerId !== null && agentId === assignedManagerId;
}