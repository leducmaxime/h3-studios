import { describe, it, expect } from "vitest";

describe("Example Test Suite", () => {
  it("should pass a simple arithmetic test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should verify basic string operations", () => {
    const greeting = "Hello, vitest!";
    expect(greeting).toContain("vitest");
  });
});
