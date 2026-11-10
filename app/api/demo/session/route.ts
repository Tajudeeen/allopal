import { NextRequest, NextResponse } from "next/server";
import {
  assertSameOrigin,
  newSession,
  requireWorkspace,
  sameSecret,
  SESSION_COOKIE,
  AccessError,
  accessResponse,
} from "@/lib/security/access";
import { seed } from "@/prisma/seed";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    await requireWorkspace(req);
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    return accessResponse(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const publicDemo =
      process.env.ALLOPAL_PUBLIC_DEMO === "true" ||
      process.env.VERCEL === "1" ||
      Boolean(process.env.VERCEL_URL);
    const configured = process.env.ALLOPAL_DEMO_ACCESS_KEY;
    if (!publicDemo) {
      if (
        process.env.NODE_ENV === "production" &&
        (!configured || configured.length < 32)
      )
        throw new AccessError(503, "DEMO_ACCESS_NOT_CONFIGURED");
      let body: { accessKey?: unknown };
      try {
        body = await req.json();
      } catch {
        throw new AccessError(400, "INVALID_JSON");
      }
      const supplied = typeof body.accessKey === "string" ? body.accessKey : "";
      if (configured && !sameSecret(supplied, configured))
        throw new AccessError(401, "ACCESS_KEY_INVALID");
      // Local development may omit a key. Never allow this on a deployed production build.
      if (
        !configured &&
        !["localhost", "127.0.0.1"].includes(new URL(req.url).hostname)
      )
        throw new AccessError(403, "LOCAL_DEVELOPMENT_ONLY");
    }
    const session = await newSession();
    await seed(session.workspaceId);
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return accessResponse(error);
  }
}
