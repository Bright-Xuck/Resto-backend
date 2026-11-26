import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import argon2 from "argon2";
import type { PhoneOtp, User } from "../generated/prisma/client.ts";
import { authRepository } from "../repositories/auth.repository.ts";
import { decryptSecret, encryptSecret } from "../util/mfaCrypto.ts";
import {
	createAccessToken,
	createMfaToken,
	createRefreshToken,
	createSecureToken,
	hashToken,
	refreshTokenLifetimeMs,
	verifyMfaToken,
} from "../util/tokens.ts";
import { buildTotpUri, createTotpSecret, verifyTotpCode } from "../util/totp.ts";

const OTP_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const EMAIL_TOKEN_MINUTES = 60;
const CONSENT_DOCUMENT = "terms_of_service";
const CONSENT_VERSION = "1.0";
const RESET_PASSWORD_URL = "http://localhost:3000/reset-password";

// Public user shape returned to clients; the password hash is never included.
export type PublicUser = Omit<User, "passwordHash">;

// A failed service call with its HTTP status and a message for the client.
export type Failure = {
	ok: false;
	status: number;
	message: string;
};

// A successful login or registration.
export type Session = {
	ok: true;
	user: PublicUser;
	accessToken: string;
	refreshToken: string;
	refreshMaxAgeMs: number;
};

// Admins must confirm a second factor before they receive a session.
export type AdminMfaChallenge = {
	ok: true;
	mfaRequired: true;
	mfaSetupRequired: boolean;
	mfaToken: string;
};

// Login either creates a session or asks the admin for an authenticator code.
export type LoginResult = Session | AdminMfaChallenge;

type RegisterInput = {
	fullName: string;
	email: string;
	password: string;
	type: "CUSTOMER" | "MERCHANT";
	locale: "en" | "fr";
	acceptedTerms: boolean;
};

type RegisterRiderInput = {
	fullName: string;
	phone: string;
	code: string;
	password: string;
	email?: string;
	locale: "en" | "fr";
	acceptedTerms: boolean;
};

type LoginInput = {
	email?: string;
	phone?: string;
	password: string;
};

// Detects a Prisma unique-constraint error (for example two registrations at once).
function isUniqueConstraintError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: string }).code === "P2002"
	);
}

// Builds the consent row that is stored when a user registers.
function newConsent() {
	return {
		id: randomUUID(),
		document: CONSENT_DOCUMENT,
		version: CONSENT_VERSION,
	};
}

// Returns a friendly failure when the last OTP is still inside its cooldown.
function otpCooldownFailure(latestOtp: PhoneOtp | null): Failure | null {
	if (!latestOtp || latestOtp.usedAt) {
		return null;
	}

	const elapsedMs = Date.now() - latestOtp.createdAt.getTime();
	const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;

	if (elapsedMs >= cooldownMs) {
		return null;
	}

	const seconds = Math.ceil((cooldownMs - elapsedMs) / 1000);

	return {
		ok: false,
		status: 429,
		message: `Please wait ${seconds} seconds before requesting another code.`,
	};
}

// Creates, hashes and logs a new OTP for a phone number and purpose.
async function createOtpForPhone(
	phone: string,
	purpose: "RIDER_SIGNUP" | "PHONE_CHANGE",
): Promise<{ ok: true; message: string } | Failure> {
	const latestOtp = await authRepository.findLatestOtp(phone, purpose);
	const cooldown = otpCooldownFailure(latestOtp);

	if (cooldown) {
		return cooldown;
	}

	if (latestOtp && !latestOtp.usedAt) {
		await authRepository.closeOtp(latestOtp.id);
	}

	const code = randomInt(0, 1_000_000).toString().padStart(6, "0");

	await authRepository.createOtp({
		id: randomUUID(),
		phone,
		purpose,
		codeHash: hashToken(code),
		expiresAt: new Date(Date.now() + OTP_MINUTES * 60 * 1000),
	});

	// There is no SMS provider yet, so the code is printed here for testing.
	console.log(`[otp] ${phone}: ${code}`);

	return {
		ok: true,
		message: "A verification code has been sent to your phone.",
	};
}

// Checks an OTP and counts wrong attempts.
async function verifyOtp(
	phone: string,
	code: string,
	purpose: "RIDER_SIGNUP" | "PHONE_CHANGE",
): Promise<{ ok: true; otp: PhoneOtp } | Failure> {
	const otp = await authRepository.findOtp(phone, purpose);

	if (!otp) {
		return {
			ok: false,
			status: 400,
			message: "This verification code is invalid or has expired.",
		};
	}

	if (otp.attempts >= OTP_MAX_ATTEMPTS) {
		await authRepository.closeOtp(otp.id);

		return {
			ok: false,
			status: 429,
			message: "Too many incorrect attempts. Please request a new code.",
		};
	}

	const providedHash = Buffer.from(hashToken(code));
	const storedHash = Buffer.from(otp.codeHash);

	if (providedHash.length !== storedHash.length || !timingSafeEqual(providedHash, storedHash)) {
		const updated = await authRepository.incrementOtpAttempts(otp.id);

		if (updated.attempts >= OTP_MAX_ATTEMPTS) {
			await authRepository.closeOtp(otp.id);

			return {
				ok: false,
				status: 429,
				message: "Too many incorrect attempts. Please request a new code.",
			};
		}

		return {
			ok: false,
			status: 400,
			message: "This verification code is incorrect.",
		};
	}

	return { ok: true, otp };
}

// Creates a customer or merchant account and starts a session.
export async function register(
	input: RegisterInput,
	deviceId: string | null = null,
): Promise<Session | Failure> {
	const existing = await authRepository.findUserByEmail(input.email);

	if (existing) {
		return {
			ok: false,
			status: 409,
			message: "This email is already registered.",
		};
	}

	const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
	let user: User;

	try {
		user = await authRepository.createUserWithConsent(
			{
				id: randomUUID(),
				type: input.type,
				email: input.email,
				phone: null,
				passwordHash,
				fullName: input.fullName,
				locale: input.locale,
			},
			newConsent(),
		);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return {
				ok: false,
				status: 409,
				message: "This email is already registered.",
			};
		}

		throw error;
	}

	return issueSession(user, deviceId);
}

// Creates a six-digit verification code for a rider phone number.
export async function requestRiderOtp(
	phone: string,
): Promise<{ ok: true; message: string } | Failure> {
	const existing = await authRepository.findUserByPhone(phone);

	if (existing) {
		return {
			ok: false,
			status: 409,
			message: "This phone number is already registered.",
		};
	}

	return createOtpForPhone(phone, "RIDER_SIGNUP");
}

// Checks the rider verification code and creates the rider account.
export async function registerRider(
	input: RegisterRiderInput,
	deviceId: string | null = null,
): Promise<Session | Failure> {
	const existing = await authRepository.findUserByPhone(input.phone);

	if (existing) {
		return {
			ok: false,
			status: 409,
			message: "This phone number is already registered.",
		};
	}

	const otpResult = await verifyOtp(input.phone, input.code, "RIDER_SIGNUP");

	if (!otpResult.ok) {
		return otpResult;
	}

	const email = input.email ?? null;

	if (email) {
		const emailOwner = await authRepository.findUserByEmail(email);

		if (emailOwner) {
			return {
				ok: false,
				status: 409,
				message: "This email is already registered.",
			};
		}
	}

	const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
	let user: User | null;

	try {
		user = await authRepository.createRiderWithOtp(
			otpResult.otp.id,
			{
				id: randomUUID(),
				type: "RIDER",
				email,
				phone: input.phone,
				passwordHash,
				fullName: input.fullName,
				locale: input.locale,
				phoneVerifiedAt: new Date(),
			},
			newConsent(),
		);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return {
				ok: false,
				status: 409,
				message: "This phone number or email is already registered.",
			};
		}

		throw error;
	}

	if (!user) {
		return {
			ok: false,
			status: 400,
			message: "This verification code has already been used.",
		};
	}

	return issueSession(user, deviceId);
}

// Logs in with an email or phone number and a password.
export async function login(
	input: LoginInput,
	deviceId: string | null = null,
): Promise<LoginResult | Failure> {
	let user: User | null = null;

	if (input.email) {
		user = await authRepository.findUserByEmail(input.email);
	} else if (input.phone) {
		user = await authRepository.findUserByPhone(input.phone);
	}

	if (!user) {
		return {
			ok: false,
			status: 401,
			message: "The email/phone or password is incorrect.",
		};
	}

	if (user.lockedUntil && user.lockedUntil > new Date()) {
		return {
			ok: false,
			status: 423,
			message: `This account is locked. Try again in ${LOGIN_LOCK_MINUTES} minutes.`,
		};
	}

	if (user.status !== "ACTIVE") {
		return {
			ok: false,
			status: 403,
			message: "This account is not active.",
		};
	}

	const passwordMatches = await argon2.verify(user.passwordHash, input.password);

	if (!passwordMatches) {
		const failedAttempts = user.failedAttempts + 1;
		const shouldLock = failedAttempts >= MAX_LOGIN_ATTEMPTS;
		const lockedUntil = shouldLock
			? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000)
			: user.lockedUntil;

		await authRepository.recordFailedLogin(user.id, failedAttempts, lockedUntil);

		if (shouldLock) {
			return {
				ok: false,
				status: 423,
				message: `Too many incorrect attempts. This account is locked for ${LOGIN_LOCK_MINUTES} minutes.`,
			};
		}

		return {
			ok: false,
			status: 401,
			message: "The email/phone or password is incorrect.",
		};
	}

	await authRepository.resetFailedLogin(user.id);

	// Admins get a challenge token instead of a session until a second factor is confirmed.
	if (user.type === "ADMIN") {
		if (!user.adminRole) {
			return {
				ok: false,
				status: 403,
				message: "This admin account has no role assigned. Contact a super admin.",
			};
		}

		const mfa = await authRepository.findAdminMfa(user.id);

		return {
			ok: true,
			mfaRequired: true,
			mfaSetupRequired: !mfa?.enabledAt,
			mfaToken: createMfaToken(user.id),
		};
	}

	return issueSession(user, deviceId);
}

// Creates a new access token and rotates the refresh token.
export async function refresh(
	refreshToken: string,
): Promise<
	{
		ok: true;
		userId: string;
		accessToken: string;
		refreshToken: string;
		refreshMaxAgeMs: number;
	} | Failure
> {
	const record = await authRepository.findRefreshToken(hashToken(refreshToken));

	if (!record) {
		return {
			ok: false,
			status: 401,
			message: "This refresh token is invalid.",
		};
	}

	if (record.usedAt) {
		await authRepository.revokeTokenFamily(record.familyId, "REUSE_DETECTED");

		return {
			ok: false,
			status: 401,
			message: "This refresh token was already used. Please log in again.",
		};
	}

	if (record.revokedAt) {
		return {
			ok: false,
			status: 401,
			message: "This refresh token has been revoked. Please log in again.",
		};
	}

	if (record.expiresAt <= new Date()) {
		await authRepository.revokeRefreshToken(record.id, "EXPIRED");

		return {
			ok: false,
			status: 401,
			message: "This refresh token has expired. Please log in again.",
		};
	}

	if (record.user.deletedAt || record.user.status !== "ACTIVE") {
		return {
			ok: false,
			status: 403,
			message: "This account is not active.",
		};
	}

	const next = createRefreshToken();
	const refreshMaxAgeMs = refreshTokenLifetimeMs(record.user.type);
	const rotated = await authRepository.rotateRefreshToken(record.id, {
		id: randomUUID(),
		userId: record.userId,
		familyId: record.familyId,
		tokenHash: next.hash,
		deviceId: record.deviceId,
		expiresAt: new Date(Date.now() + refreshMaxAgeMs),
	});

	if (!rotated) {
		await authRepository.revokeTokenFamily(record.familyId, "REUSE_DETECTED");

		return {
			ok: false,
			status: 401,
			message: "This refresh token was already used. Please log in again.",
		};
	}

	return {
		ok: true,
		userId: record.userId,
		accessToken: createAccessToken(record.user),
		refreshToken: next.token,
		refreshMaxAgeMs,
	};
}

// Revokes the refresh token so it can no longer create access tokens.
export async function logout(refreshToken: string): Promise<{ ok: true; message: string }> {
	const record = await authRepository.findRefreshToken(hashToken(refreshToken));

	if (record && !record.revokedAt) {
		await authRepository.revokeRefreshToken(record.id, "LOGOUT");
	}

	return {
		ok: true,
		message: "You have been logged out.",
	};
}

// Revokes every active refresh token for one user.
export async function logoutAll(userId: string): Promise<{ ok: true; message: string }> {
	await authRepository.revokeAllRefreshTokens(userId, "LOGOUT_ALL");

	return {
		ok: true,
		message: "You have been logged out of all devices.",
	};
}

// Returns the signed-in user's public profile.
export async function getMe(
	userId: string,
): Promise<{ ok: true; user: PublicUser } | Failure> {
	const user = await authRepository.findUserById(userId);

	if (!user) {
		return {
			ok: false,
			status: 401,
			message: "This account no longer exists.",
		};
	}

	return {
		ok: true,
		user: toPublicUser(user),
	};
}

// Creates a password reset token and logs the reset link.
export async function forgotPassword(email: string): Promise<{ ok: true; message: string }> {
	const user = await authRepository.findUserByEmail(email);

	if (user && user.status === "ACTIVE") {
		await authRepository.invalidateEmailTokens(user.id, "RESET_PASSWORD");

		const reset = createSecureToken();

		await authRepository.createEmailToken({
			id: randomUUID(),
			userId: user.id,
			purpose: "RESET_PASSWORD",
			tokenHash: reset.hash,
			expiresAt: new Date(Date.now() + EMAIL_TOKEN_MINUTES * 60 * 1000),
		});

		// There is no email provider yet, so the link is printed here for testing.
		console.log(`[email] Password reset for ${email}: ${RESET_PASSWORD_URL}?token=${reset.token}`);
	}

	return {
		ok: true,
		message: "If that email is registered, a password reset link has been sent.",
	};
}

// Consumes a reset token, changes the password and revokes old sessions.
export async function resetPassword(
	token: string,
	newPassword: string,
): Promise<{ ok: true; message: string; userId: string } | Failure> {
	const record = await authRepository.findEmailToken(hashToken(token), "RESET_PASSWORD");

	if (!record) {
		return {
			ok: false,
			status: 400,
			message: "This reset link is invalid or has expired.",
		};
	}

	const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
	const updated = await authRepository.resetPasswordWithToken(
		record.id,
		record.userId,
		passwordHash,
	);

	if (!updated) {
		return {
			ok: false,
			status: 400,
			message: "This reset link has already been used.",
		};
	}

	return {
		ok: true,
		message: "Your password has been updated. Please log in again.",
		userId: record.userId,
	};
}

// Sends a verification code before a rider changes their phone number.
export async function requestPhoneChange(
	userId: string,
	phone: string,
): Promise<{ ok: true; message: string } | Failure> {
	const user = await authRepository.findUserById(userId);

	if (!user) {
		return {
			ok: false,
			status: 401,
			message: "This account no longer exists.",
		};
	}

	const owner = await authRepository.findUserByPhone(phone);

	if (owner && owner.id !== userId) {
		return {
			ok: false,
			status: 409,
			message: "This phone number is already registered.",
		};
	}

	return createOtpForPhone(phone, "PHONE_CHANGE");
}

// Verifies the code and changes the rider phone number.
export async function verifyPhoneChange(
	userId: string,
	phone: string,
	code: string,
): Promise<{ ok: true; message: string } | Failure> {
	const otpResult = await verifyOtp(phone, code, "PHONE_CHANGE");

	if (!otpResult.ok) {
		return otpResult;
	}

	let updated: boolean;

	try {
		updated = await authRepository.changePhoneWithOtp(otpResult.otp.id, userId, phone);
	} catch (error) {
		if (isUniqueConstraintError(error)) {
			return {
				ok: false,
				status: 409,
				message: "This phone number is already registered.",
			};
		}

		throw error;
	}

	if (!updated) {
		return {
			ok: false,
			status: 400,
			message: "This verification code has already been used.",
		};
	}

	return {
		ok: true,
		message: "Your phone number has been updated.",
	};
}

// Checks the short-lived MFA token and loads the admin it belongs to.
async function adminFromMfaToken(
	mfaToken: string,
): Promise<{ ok: true; user: User } | Failure> {
	let userId: string;

	try {
		userId = verifyMfaToken(mfaToken);
	} catch {
		return {
			ok: false,
			status: 401,
			message: "This confirmation token is invalid or has expired. Please log in again.",
		};
	}

	const user = await authRepository.findUserById(userId);

	if (!user || user.type !== "ADMIN" || !user.adminRole || user.status !== "ACTIVE") {
		return {
			ok: false,
			status: 401,
			message: "This admin account is not available.",
		};
	}

	return { ok: true, user };
}

// Turns a stored encrypted secret back into the base32 value, or null if unreadable.
function readTotpSecret(secretEncrypted: string): string | null {
	try {
		return decryptSecret(secretEncrypted);
	} catch {
		return null;
	}
}

// Recovery codes are shown once and only their hashes are stored.
async function storeNewRecoveryCodes(userId: string): Promise<string[]> {
	const codes = Array.from({ length: 8 }, () => {
		const raw = randomBytes(5).toString("hex").toUpperCase();

		return `${raw.slice(0, 5)}-${raw.slice(5)}`;
	});

	await authRepository.replaceAdminRecoveryCodes(
		userId,
		codes.map((code) => ({ id: randomUUID(), codeHash: hashToken(code) })),
	);

	return codes;
}

// Accepts a recovery code typed with or without its hyphen.
function normalizeRecoveryCode(code: string): string {
	const trimmed = code.trim().toUpperCase();

	if (/^[A-F0-9]{10}$/.test(trimmed)) {
		return `${trimmed.slice(0, 5)}-${trimmed.slice(5)}`;
	}

	return trimmed;
}

// Starts MFA enrolment and stores the pending secret.
export async function setupAdminMfa(
	mfaToken: string,
): Promise<{ ok: true; secret: string; otpauthUri: string } | Failure> {
	const found = await adminFromMfaToken(mfaToken);

	if (!found.ok) {
		return found;
	}

	const existing = await authRepository.findAdminMfa(found.user.id);

	if (existing?.enabledAt) {
		return {
			ok: false,
			status: 409,
			message: "Two-factor authentication is already enabled.",
		};
	}

	const secret = createTotpSecret();
	await authRepository.upsertAdminMfa(found.user.id, encryptSecret(secret));

	return {
		ok: true,
		secret,
		otpauthUri: buildTotpUri(found.user.email ?? found.user.id, secret),
	};
}

// Confirms the first code, enables MFA and returns recovery codes plus a session.
export async function enableAdminMfa(
	mfaToken: string,
	code: string,
	deviceId: string | null = null,
): Promise<(Session & { recoveryCodes: string[] }) | Failure> {
	const found = await adminFromMfaToken(mfaToken);

	if (!found.ok) {
		return found;
	}

	const record = await authRepository.findAdminMfa(found.user.id);

	if (!record) {
		return {
			ok: false,
			status: 400,
			message: "Start the two-factor setup step first.",
		};
	}

	if (record.enabledAt) {
		return {
			ok: false,
			status: 409,
			message: "Two-factor authentication is already enabled.",
		};
	}

	const secret = readTotpSecret(record.secretEncrypted);

	if (!secret) {
		return {
			ok: false,
			status: 400,
			message: "The setup secret could not be read. Start the setup step again.",
		};
	}

	if (!verifyTotpCode(secret, code)) {
		return {
			ok: false,
			status: 401,
			message: "That authenticator code is incorrect.",
		};
	}

	await authRepository.enableAdminMfa(found.user.id);
	const recoveryCodes = await storeNewRecoveryCodes(found.user.id);
	const session = await issueSession(found.user, deviceId);

	return { ...session, recoveryCodes };
}

// Completes an admin login with a TOTP code or a one-time recovery code.
export async function verifyAdminMfaLogin(
	mfaToken: string,
	code: string,
	deviceId: string | null = null,
): Promise<Session | Failure> {
	const found = await adminFromMfaToken(mfaToken);

	if (!found.ok) {
		return found;
	}

	const record = await authRepository.findAdminMfa(found.user.id);

	if (!record?.enabledAt) {
		return {
			ok: false,
			status: 400,
			message: "Two-factor authentication is not set up for this account.",
		};
	}

	const secret = readTotpSecret(record.secretEncrypted);

	if (!secret) {
		return {
			ok: false,
			status: 400,
			message: "The stored secret could not be read. Contact a super admin.",
		};
	}

	let valid = verifyTotpCode(secret, code);

	// A recovery code also works, but only once.
	if (!valid) {
		const recovery = await authRepository.findUnusedRecoveryCode(
			hashToken(normalizeRecoveryCode(code)),
		);

		if (recovery) {
			await authRepository.useRecoveryCode(recovery.id);
			valid = true;
		}
	}

	if (!valid) {
		return {
			ok: false,
			status: 401,
			message: "That authenticator code is incorrect.",
		};
	}

	return issueSession(found.user, deviceId);
}

// Turns MFA off after checking the password and a current code.
export async function disableAdminMfa(
	userId: string,
	password: string,
	code: string,
): Promise<{ ok: true; message: string } | Failure> {
	const user = await authRepository.findUserById(userId);

	if (!user || user.type !== "ADMIN") {
		return {
			ok: false,
			status: 401,
			message: "This admin account is not available.",
		};
	}

	const passwordMatches = await argon2.verify(user.passwordHash, password);

	if (!passwordMatches) {
		return {
			ok: false,
			status: 401,
			message: "Your password is incorrect.",
		};
	}

	const record = await authRepository.findAdminMfa(userId);

	if (!record?.enabledAt) {
		return {
			ok: false,
			status: 400,
			message: "Two-factor authentication is not enabled.",
		};
	}

	const secret = readTotpSecret(record.secretEncrypted);

	if (!secret || !verifyTotpCode(secret, code)) {
		return {
			ok: false,
			status: 401,
			message: "That authenticator code is incorrect.",
		};
	}

	await authRepository.deleteAdminMfa(userId);

	return {
		ok: true,
		message: "Two-factor authentication has been turned off.",
	};
}

// Confirms a fresh TOTP code and returns an access token marked as stepped up.
export async function stepUpAdmin(
	userId: string,
	code: string,
): Promise<{ ok: true; accessToken: string } | Failure> {
	const user = await authRepository.findUserById(userId);

	if (!user || user.type !== "ADMIN" || !user.adminRole) {
		return {
			ok: false,
			status: 401,
			message: "This admin account is not available.",
		};
	}

	const record = await authRepository.findAdminMfa(userId);

	if (!record?.enabledAt) {
		return {
			ok: false,
			status: 400,
			message: "Set up two-factor authentication first.",
		};
	}

	const secret = readTotpSecret(record.secretEncrypted);

	if (!secret || !verifyTotpCode(secret, code)) {
		return {
			ok: false,
			status: 401,
			message: "That authenticator code is incorrect.",
		};
	}

	return {
		ok: true,
		accessToken: createAccessToken(user, { stepUp: true }),
	};
}

// Stores a hashed refresh token and builds the full login session.
async function issueSession(user: User, deviceId: string | null): Promise<Session> {
	const refreshToken = createRefreshToken();
	const refreshMaxAgeMs = refreshTokenLifetimeMs(user.type);

	await authRepository.createRefreshToken({
		id: randomUUID(),
		userId: user.id,
		familyId: randomUUID(),
		tokenHash: refreshToken.hash,
		deviceId,
		expiresAt: new Date(Date.now() + refreshMaxAgeMs),
	});

	return {
		ok: true,
		user: toPublicUser(user),
		accessToken: createAccessToken(user),
		refreshToken: refreshToken.token,
		refreshMaxAgeMs,
	};
}

// Removes the password hash before a user is sent to the client.
function toPublicUser(user: User): PublicUser {
	const { passwordHash, ...publicUser } = user;

	return publicUser;
}
