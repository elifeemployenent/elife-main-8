import {
  canPublishVirtualOfficeAnnouncement,
  validateVirtualOfficeAnnouncementInput,
} from "./virtualOfficeAuthorization.ts";

Deno.test("only the active assigned Office Manager can publish announcements", () => {
  if (!canPublishVirtualOfficeAnnouncement("manager-a", "manager-a", true)) {
    throw new Error("The active assigned Office Manager should be allowed to publish.");
  }
  if (canPublishVirtualOfficeAnnouncement("agent-b", "manager-a", true)) {
    throw new Error("A different agent must not be allowed to publish.");
  }
  if (canPublishVirtualOfficeAnnouncement("manager-a", "manager-a", false)) {
    throw new Error("An inactive Office Manager must not be allowed to publish.");
  }
});

Deno.test("announcement input enforces a valid Panchayath, title, and body", () => {
  const valid = validateVirtualOfficeAnnouncementInput({
    panchayath_id: "00000000-0000-4000-8000-000000000001",
    title: "Office hours",
    body: "The office is open this afternoon.",
  });
  if (!valid.valid) throw new Error("Valid announcement input was rejected.");

  const invalid = validateVirtualOfficeAnnouncementInput({
    panchayath_id: "not-a-uuid",
    title: " ",
    body: " ",
  });
  if (invalid.valid) throw new Error("Invalid announcement input must be rejected.");
});