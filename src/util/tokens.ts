import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { User, UserType } from "../generated/prisma/client.ts";

const JWT_SECRET = process.env.JWT_SECRET ?? "";

if (!JWT_SECRET) {
	throw new Error("JWT_SECRET is missing from .env");
}

const ACCESS_TOKEN_MINUTES = 15;
export const REFRESH_TOKEN_DAYS = 30;

// Data stored inside an access token.
export type AccessTokenUser = {
	sub: string;
	type: UserType;
};

// Creates a short-lived JWT access token for a user.
export function createAccessToken(user: User): string {
	return jwt.sign({ sub: user.id, type: user.type }, JWT_SECRET, {
		expiresIn: ACCESS_TOKEN_MINUTES * 60,
	});
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
	};
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
