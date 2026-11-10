import { ProviderConfigurationError } from "@/lib/env";
import {
  createHash,
  timingSafeEqual,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const SESSION_COOKIE = "allopal_demo_session";
export class AccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AccessError";
    Object.setPrototypeOf(this, AccessError.prototype);
  }
}

export function isProviderConfigurationError(
  error: unknown,
): error is ProviderConfigurationError {
  if (error instanceof ProviderConfigurationError) return true;
  if (typeof error === "object" && error !== null) {
    const err = error as { name?: string; message?: string };
    if (err.name === "ProviderConfigurationError") return true;
    if (
      typeof err.message === "string" &&
      (err.message.startsWith("AI_NOT_CONFIGURED") ||
        err.message.startsWith("PAYPAL_NOT_CONFIGURED"))
    )
      return true;
  }
  return false;
}

export function isAccessError(error: unknown): error is AccessError {
  if (error instanceof AccessError) return true;
  if (typeof error === "object" && error !== null) {
    const err = error as { name?: string; status?: number; message?: string };
    if (err.name === "AccessError" && typeof err.status === "number") return true;
  }
  return false;
}
export function sameSecret(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = requestOrigin(req);
  // Reject explicit cross-site requests and mismatched browser origins.
  // Some browser runtimes omit Origin on same-origin fetches. Those requests
  // still need the HttpOnly, host-only, SameSite=Lax session cookie checked
  // by requireWorkspace before any protected operation can run.
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new AccessError(403, "ORIGIN_REJECTED");
  if (origin && origin !== new URL(expected).origin)
    throw new AccessError(403, "ORIGIN_REJECTED");
}
export async function requireWorkspace(req?: NextRequest) {
  if (!req) throw new AccessError(401, "SESSION_REQUIRED");
  if (!["GET", "HEAD"].includes(req.method)) assertSameOrigin(req);
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) throw new AccessError(401, "SESSION_REQUIRED");
  const session = await prisma.demoSession.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
  });
  if (!session || session.expiresAt <= new Date())
    throw new AccessError(401, "SESSION_EXPIRED");
  return session.workspaceId;
}
export async function newSession() {
  const token = randomBytes(32).toString("hex");
  const workspaceId = randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  await prisma.demoSession.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      workspaceId,
      expiresAt,
    },
  });
  return { token, workspaceId, expiresAt };
}
export function accessResponse(error: unknown) {
  console.error("API error in accessResponse:", error);
  if (isProviderConfigurationError(error)) {
    const msg = (error as Error).message;
    return NextResponse.json(
      {
        error: msg.split(":")[0],
        message:
          "The builder needs to configure this provider before it can be used.",
      },
      { status: 503 },
    );
  }
  if (isAccessError(error)) {
    return NextResponse.json(
      { error: (error as AccessError).message },
      { status: (error as AccessError).status },
    );
  }
  return NextResponse.json(
    {
      error: "REQUEST_FAILED",
      message: "The request could not be completed. Try again safely.",
    },
    { status: 500 },
  );
}
export function requestOrigin(req: NextRequest) {
  // Validate against the public host that received this request. VERCEL_URL
  // points at a deployment-specific hostname and can differ from the public
  // alias (for example, allopal.vercel.app).
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = (forwardedHost || req.headers.get("host"))?.split(",")[0]?.trim();
  if (host) {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwardedProto || new URL(req.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }

  if (process.env.APP_BASE_URL) return new URL(process.env.APP_BASE_URL).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(req.url).origin;
}
export function paymentOrigin(req: NextRequest) {
  const origin = requestOrigin(req);
  const url = new URL(origin);
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:"
  )
    throw new AccessError(503, "APP_BASE_URL_REQUIRED");
  return url.origin;
}
