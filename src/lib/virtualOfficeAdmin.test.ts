import { describe, expect, it } from "vitest";
import { getAttendanceSummary, getIndiaDateKey, splitOfficeAudience } from "./virtualOfficeAdmin";

describe("Virtual Office admin summaries", () => {
  it("counts two checked-in agents and one absent agent out of three", () => {
    expect(getAttendanceSummary([
      { agent_id: "a", name: "A", role: "coordinator", ward: "1", panchayath_name: "Kondotty", check_in_at: "2026-11-26T04:30:00.000Z" },
      { agent_id: "b", name: "B", role: "team_leader", ward: "2", panchayath_name: "Kondotty", check_in_at: "2026-11-26T04:40:00.000Z" },
      { agent_id: "c", name: "C", role: "group_leader", ward: "3", panchayath_name: "Kondotty", check_in_at: null },
    ])).toEqual({ totalAgents: 3, present: 2, absent: 1 });
  });

  it("separates agents with a seen receipt from agents still pending", () => {
    const agents = [
      { id: "a", name: "A", role: "coordinator", ward: "1", panchayath_name: "Kondotty" },
      { id: "b", name: "B", role: "team_leader", ward: "2", panchayath_name: "Kondotty" },
    ];
    const result = splitOfficeAudience(agents, [{ agent_id: "a", seen_at: "2026-11-26T05:00:00.000Z" }]);

    expect(result.seen.map((agent) => agent.id)).toEqual(["a"]);
    expect(result.seen[0]?.seen_at).toBe("2026-11-26T05:00:00.000Z");
    expect(result.pending.map((agent) => agent.id)).toEqual(["b"]);
  });

  it("uses the India calendar date for the post date default", () => {
    expect(getIndiaDateKey(new Date("2026-11-26T18:30:00.000Z"))).toBe("2026-11-27");
  });
});