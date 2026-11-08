import { afterEach, describe, expect, it, vi } from "vitest";
import { PayPalClient } from "@/lib/paypal/client";

const client = () => new PayPalClient("fixture-client", "fixture-secret");
const token = (access_token = "fixture-token", expires_in = 3600) =>
  Response.json({ access_token, expires_in });
afterEach(() => vi.useRealTimers());

describe("PayPal credential transport and refresh", () => {
  it("shares one in-flight token request across concurrent callers", async () => {
    let release!: (response: Response) => void;
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>((resolve) => { release = resolve; }),
    );
    const provider = client();
    const requests = Array.from({ length: 12 }, () => provider.getAccessToken());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]?.redirect).toBe("error");
    release(token());
    expect(await Promise.all(requests)).toEqual(Array(12).fill("fixture-token"));
    expect(await provider.getAccessToken()).toBe("fixture-token");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("clears a failed shared refresh so the next request can recover", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("synthetic transport failure"))
      .mockResolvedValueOnce(token("recovered-token"));
    const provider = client();
    const results = await Promise.allSettled([
      provider.getAccessToken(), provider.getAccessToken(),
    ]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await provider.getAccessToken()).toBe("recovered-token");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("coalesces refreshes when a cached token approaches expiry", async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(token("first"))
        .mockResolvedValueOnce(token("second"));
      const provider = client();
      expect(await provider.getAccessToken()).toBe("first");
      vi.advanceTimersByTime(3_550_000);
      expect(await Promise.all([provider.getAccessToken(), provider.getAccessToken()]))
        .toEqual(["second", "second"]);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(["https://example.com", "http://api-m.paypal.com", "https://api-m.paypal.com/path", "https://api-m.paypal.com?token=x", "https://user:pass@api-m.paypal.com"])
    ("rejects unsupported API destinations before sending credentials: %s", (origin) => {
      const fetch = vi.spyOn(globalThis, "fetch");
      expect(() => new PayPalClient("fixture-client", "fixture-secret", origin))
        .toThrow("PAYPAL_ORIGIN_UNSUPPORTED");
      expect(fetch).not.toHaveBeenCalled();
    });

  it.each([0, -1, Number.MAX_VALUE])("rejects invalid token lifetime %s", async (lifetime) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(token("fixture-token", lifetime));
    await expect(client().getAccessToken()).rejects.toThrow("invalid token response");
  });
});
