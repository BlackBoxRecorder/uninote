import { NextRequest, NextResponse } from "next/server";
import { compareSync } from "bcryptjs";
import { getDatabase } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/auth";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  // Rate limit check
  const { allowed, remaining, resetAt } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "登录尝试次数过多，请稍后再试" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": String(remaining),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const { key } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "请输入密钥" }, { status: 400 });
    }

    const db = getDatabase();
    const user = db.select().from(users).where(eq(users.id, "admin")).get();

    if (!user || !compareSync(key, user.passwordHash)) {
      return NextResponse.json(
        { error: "密钥错误", remaining },
        { status: 401 }
      );
    }

    // Success - reset rate limit and issue token
    resetRateLimit(ip);
    const token = await signToken();

    const response = NextResponse.json({ success: true });
    response.cookies.set("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
}
