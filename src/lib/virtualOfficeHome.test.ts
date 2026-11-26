import { describe, expect, it } from "vitest";
import { parseHomeViewPreference, resolveDirectPanchayath } from "./homeViewPreference";

const panchayaths = [
  { id: "office-1", name: "Kondotty", code: "KDY" },
  { id: "office-2", name: "Perinthalmanna", code: "PMNA" },
];

describe("Virtual Office home preferences", () => {
  it("defaults to Classic Home unless Virtual Office was explicitly saved", () => {
    expect(parseHomeViewPreference(null)).toBe("classic");
    expect(parseHomeViewPreference("unknown")).toBe("classic");
    expect(parseHomeViewPreference("classic")).toBe("classic");
    expect(parseHomeViewPreference("virtual-office")).toBe("virtual-office");
  });

  it("resolves a direct Panchayath link by id, code, or name slug", () => {
    expect(resolveDirectPanchayath("office-1", panchayaths)?.id).toBe("office-1");
    expect(resolveDirectPanchayath("pmna", panchayaths)?.id).toBe("office-2");
    expect(resolveDirectPanchayath("perinthalmanna", panchayaths)?.id).toBe("office-2");
    expect(resolveDirectPanchayath("not-a-panchayath", panchayaths)).toBeNull();
  });
});