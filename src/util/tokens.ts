import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { AdminRole, User, UserType } from "../generated/prisma/client.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

if (!JWT_SECRET) {
	throw new Error("JWT_SECRET is missing from .env");
}

const ACCESS_TOKEN_MINUTES = 15;
const MFA_TOKEN_MINUTES = 5;
const ADMIN_REFRESH_HOURS = 8;
export const REFRESH_TOKEN_DAYS = 30;

// Data stored inside an access token.
export type AccessTokenUser = {
	sub: string;
	type: UserType;
	adminRole?: AdminRole | null;
	stepUpAt?: number;
};

// Creates a short-lived JWT access token for a user.
export function createAccessToken(user: User, options: { stepUp?: boolean } = {}): string {
	const payload: Record<string, unknown> = {
		sub: user.id,
		type: user.type,
	};

	// Admin routes need the sub-role and, for sensitive actions, a fresh step-up time.
	if (user.type === "ADMIN") {
		payload.adminRole = user.adminRole;
	}

	if (options.stepUp) {
		payload.stepUpAt = Date.now();
	}

	return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_MINUTES * 60 });
}

// Verifies an access token and returns the user data inside it.
export function verifyAccessToken(token: string): AccessTokenUser {
	const payload = jwt.verify(token, JWT_SECRET);

	if (typeof payload === "string" || !payload.sub || !payload.type) {
		throw new Error("Invalid access token");
	}

	return {
		sub: payload.sub,
		type: payload.type as UserType,
		adminRole:
			typeof payload.adminRole === "string" ? (payload.adminRole as AdminRole) : undefined,
		stepUpAt: typeof payload.stepUpAt === "number" ? payload.stepUpAt : undefined,
	};
}

// Creates a five-minute token that only the MFA endpoints accept.
export function createMfaToken(userId: string): string {
	return jwt.sign({ sub: userId, purpose: "MFA" }, JWT_SECRET, {
		expiresIn: MFA_TOKEN_MINUTES * 60,
	});
}

// Checks the short-lived MFA token and returns the admin user id.
export function verifyMfaToken(token: string): string {
	const payload = jwt.verify(token, JWT_SECRET);

	if (typeof payload === "string" || payload.purpose !== "MFA" || !payload.sub) {
		throw new Error("Invalid MFA token");
	}

	return payload.sub;
}

// Admin sessions are much shorter than customer and rider sessions.
export function refreshTokenLifetimeMs(type: UserType): number {
	if (type === "ADMIN") {
		return ADMIN_REFRESH_HOURS * 60 * 60 * 1000;
	}

	return REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000;
}

// Creates any random secret token and the hash that is stored in the database.
export function createSecureToken() {
	const token = randomBytes(32).toString("base64url");

	return { token, hash: hashToken(token) };
}

// Creates a random refresh token and the hash that is stored in the database.
export function createRefreshToken() {
	return createSecureToken();
}

// Hashes a token with SHA-256 before it is stored or compared.
export function hashToken(value: string): Uint8Array<ArrayBuffer> {
	const hash = createHash("sha256").update(value).digest();

	return new Uint8Array(hash);
}
