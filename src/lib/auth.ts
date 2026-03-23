import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET_KEY = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' 
  ? (() => { throw new Error('JWT_SECRET environment variable is required in production'); })()
  : 'dev-jwt-secret-do-not-use-in-production');
const JWT_EXPIRY = process.env.JWT_EXPIRY || "7d";

function getSecretKey() {
  return new TextEncoder().encode(JWT_SECRET_KEY);
}

export async function signToken(payload: Record<string, unknown> = {}): Promise<string> {
  return new SignJWT({ sub: "admin", ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(getSecretKey());
}

export async function verifyToken(token: string): Promise<{ valid: boolean; payload?: Record<string, unknown> }> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return { valid: true, payload: payload as Record<string, unknown> };
  } catch {
    return { valid: false };
  }
}
