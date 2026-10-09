import { describe, expect, it } from "vitest";
import { SanitizePipe } from "./sanitize.pipe";

describe("SanitizePipe", () => {
  const pipe = new SanitizePipe();

  it("trims strings and strips null bytes", () => {
    expect(pipe.transform("  hello\0 ")).toBe("hello");
  });

  it("recurses into arrays and plain objects", () => {
    expect(pipe.transform({ name: "  x ", tags: [" a ", "b  "] })).toEqual({
      name: "x",
      tags: ["a", "b"],
    });
  });

  it("preserves Date instances instead of flattening them to {}", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const result = pipe.transform({ startsAt: date }) as { startsAt: unknown };
    expect(result.startsAt).toBeInstanceOf(Date);
    expect((result.startsAt as Date).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
