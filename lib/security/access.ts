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
  }
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
  if (origin && origin !== new URL(expected).origin)
    throw new AccessError(403, "ORIGIN_REJECTED");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new AccessError(403, "ORIGIN_REJECTED");
  if (process.env.NODE_ENV === "production" && !origin)
    throw new AccessError(403, "ORIGIN_REQUIRED");
}
export async function requireWorkspace(req?: NextRequest) {
  if (!req) return "demo";
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return "demo";
  const session = await prisma.demoSession.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
  });
  if (!session || session.expiresAt <= new Date())
    return "demo";
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
  if (error instanceof ProviderConfigurationError)
    return NextResponse.json(
      {
        error: error.message.split(":")[0],
        message:
          "The builder needs to configure this provider before it can be used.",
      },
      { status: 503 },
    );
  if (error instanceof AccessError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  return NextResponse.json(
    {
      error: "REQUEST_FAILED",
      message: "The request could not be completed. Try again safely.",
    },
    { status: 500 },
  );
}
export function requestOrigin(req: NextRequest) {
  if (process.env.APP_BASE_URL) return new URL(process.env.APP_BASE_URL).origin;
  const url = new URL(req.url);
  const host = req.headers.get("host");
  return host ? `${url.protocol}//${host}` : url.origin;
}
export function paymentOrigin(req: NextRequest) {
  const url = new URL(requestOrigin(req));
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.APP_BASE_URL || url.protocol !== "https:")
  )
    throw new AccessError(503, "APP_BASE_URL_REQUIRED");
  return url.origin;
}
