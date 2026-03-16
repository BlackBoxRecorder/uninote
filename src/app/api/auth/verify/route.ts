import { NextResponse } from "next/server";

export async function POST() {
  // If this route is reached, the middleware already verified the token
  return NextResponse.json({ valid: true });
}
