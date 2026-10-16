import { describe, expect, it } from "vitest";
import { duration, mediaUrl } from "../src/services/api";
describe("Player presentation boundaries", () => {
  it("never shows negative, missing or non-finite playback time", () => {
    expect(duration(-1)).toBe("0:00");
    expect(duration(undefined)).toBe("0:00");
    expect(duration(NaN)).toBe("0:00");
    expect(duration(Infinity)).toBe("0:00");
    expect(duration(125.9)).toBe("2:05");
  });
  it("keeps media references on the API origin", () => {
    expect(mediaUrl("cover.png")).toBe("/api/media/cover.png");
    expect(mediaUrl("../private")).toBe("/api/media/..%2Fprivate");
    expect(mediaUrl(null)).toBe("");
  });
});
