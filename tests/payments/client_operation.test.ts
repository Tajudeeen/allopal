import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  operationKey,
  rememberOperation,
  clearSettledOperations,
} from "@/lib/payments/client-operation";
describe("Browser operation retry storage", () => {
  beforeEach(() => {
    const entries: Record<string, string> = {};
    Object.defineProperties(entries, {
      getItem: { value: (key: string) => entries[key] || null },
      setItem: {
        value: (key: string, value: string) => {
          entries[key] = value;
        },
      },
      removeItem: {
        value: (key: string) => {
          delete entries[key];
        },
      },
    });
    vi.stubGlobal("sessionStorage", entries);
  });
  it("keeps the same key across lost responses and page reloads, then clears it after verified settlement", () => {
    const scope = "cart:mandate:cart-a";
    const original = operationKey(scope);
    expect(operationKey(scope)).toBe(original);
    rememberOperation(scope, { status: "PENDING", attemptId: "attempt-a" });
    expect(operationKey(scope)).toBe(original);
    clearSettledOperations([{ id: "attempt-a", status: "COMPLETED" }]);
    expect(operationKey(scope)).not.toBe(original);
  });
  it("retains an unknown result while clearing a terminal denial", () => {
    const original = operationKey("agent:buy notebooks");
    rememberOperation("agent:buy notebooks", {});
    expect(operationKey("agent:buy notebooks")).toBe(original);
    rememberOperation("agent:buy notebooks", { status: "DENIED" });
    expect(operationKey("agent:buy notebooks")).not.toBe(original);
  });
});
