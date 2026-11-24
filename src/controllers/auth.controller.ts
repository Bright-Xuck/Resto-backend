import type { Request, Response } from "express";
import { recordAudit } from "../services/audit.service.ts";
import {
	forgotPassword,
	getMe as getMeService,
	login,
	logout,
	logoutAll,
	refresh,
	register,
	registerRider,
	requestPhoneChange,
	requestRiderOtp,
	resetPassword,
	verifyPhoneChange,
} from "../services/auth.service.ts";
import { REFRESH_TOKEN_DAYS } from "../util/tokens.ts";
import {
	forgotPasswordSchema,
	loginSchema,
	phoneChangeRequestSchema,
	phoneChangeVerifySchema,
	registerRiderSchema,
	registerSchema,
	requestOtpSchema,
	resetPasswordSchema,
} from "../validations/auth.validation.ts";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax" as const,
	path: "/",
};

// Reads the optional device id sent by the client.
function getDeviceId(req: Request): string | null {
	const value = req.headers["x-device-id"];

	if (typeof value === "string" && value.trim()) {
		return value.trim().slice(0, 200);
	}

	return null;
}

// POST /api/auth/register - creates a customer or merchant account.
export async function registerUser(req: Request, res: Response) {
	const result = registerSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const session = await register(result.data, getDeviceId(req));

		if (!session.ok) {
			await recordAudit(req, "REGISTER_FAILED", undefined, result.data.email);
			res.status(session.status).json({ message: session.message });
			return;
		}

		await recordAudit(req, "REGISTER", session.user.id);

		// Keep the refresh token out of JavaScript and send it as an HttpOnly cookie.
		res.cookie(REFRESH_COOKIE, session.refreshToken, {
			...REFRESH_COOKIE_OPTIONS,
			maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
		});

		res.status(201).json({
			user: session.user,
			accessToken: session.accessToken,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not create your account. Please try again." });
	}
}

// POST /api/auth/otp/request - sends a rider signup code to a Cameroon number.
export async function requestOtp(req: Request, res: Response) {
	const result = requestOtpSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await requestRiderOtp(result.data.phone);

		if (!response.ok) {
			await recordAudit(req, "OTP_REQUEST_FAILED", undefined, result.data.phone);
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAudit(req, "OTP_REQUESTED", undefined, result.data.phone);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not send the code. Please try again." });
	}
}

// POST /api/auth/register/rider - verifies the code and creates a rider account.
export async function registerRiderUser(req: Request, res: Response) {
	const result = registerRiderSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const session = await registerRider(result.data, getDeviceId(req));

		if (!session.ok) {
			await recordAudit(req, "RIDER_REGISTER_FAILED", undefined, result.data.phone);
			res.status(session.status).json({ message: session.message });
			return;
		}

		await recordAudit(req, "RIDER_REGISTERED", session.user.id);

		// Rider accounts receive the same HttpOnly refresh cookie as other users.
		res.cookie(REFRESH_COOKIE, session.refreshToken, {
			...REFRESH_COOKIE_OPTIONS,
			maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
		});

		res.status(201).json({
			user: session.user,
			accessToken: session.accessToken,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not create your rider account. Please try again." });
	}
}

// POST /api/auth/login - logs in with an email or Cameroon phone number.
export async function loginUser(req: Request, res: Response) {
	const result = loginSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const session = await login(result.data, getDeviceId(req));

		if (!session.ok) {
			await recordAudit(
				req,
				"LOGIN_FAILED",
				undefined,
				result.data.email ?? result.data.phone,
			);
			res.status(session.status).json({ message: session.message });
			return;
		}

		await recordAudit(req, "LOGIN", session.user.id);

		// A new login always gets a fresh HttpOnly refresh cookie.
		res.cookie(REFRESH_COOKIE, session.refreshToken, {
			...REFRESH_COOKIE_OPTIONS,
			maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
		});

		res.status(200).json({
			user: session.user,
			accessToken: session.accessToken,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not log you in. Please try again." });
	}
}

// POST /api/auth/refresh - rotates the refresh cookie and returns a new access token.
export async function refreshSession(req: Request, res: Response) {
	const refreshToken = req.cookies[REFRESH_COOKIE];

	if (typeof refreshToken !== "string" || !refreshToken) {
		res.status(401).json({ message: "The refresh cookie is missing. Please log in again." });
		return;
	}

	try {
		const response = await refresh(refreshToken);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAudit(req, "TOKEN_REFRESHED", response.userId);

		// Rotation replaces the old cookie with the new refresh token.
		res.cookie(REFRESH_COOKIE, response.refreshToken, {
			...REFRESH_COOKIE_OPTIONS,
			maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
		});

		res.status(200).json({ accessToken: response.accessToken });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not refresh your session. Please log in again." });
	}
}

// POST /api/auth/logout - revokes the current refresh token and clears the cookie.
export async function logoutUser(req: Request, res: Response) {
	const refreshToken = req.cookies[REFRESH_COOKIE];

	if (typeof refreshToken !== "string" || !refreshToken) {
		res.status(401).json({ message: "The refresh cookie is missing. Please log in again." });
		return;
	}

	try {
		const response = await logout(refreshToken);

		await recordAudit(req, "LOGOUT");
		res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not log you out. Please try again." });
	}
}

// POST /api/auth/logout-all - revokes every session for the signed-in user.
export async function logoutAllDevices(req: Request, res: Response) {
	if (!req.user) {
		res.status(401).json({ message: "You must be logged in to log out of all devices." });
		return;
	}

	try {
		const response = await logoutAll(req.user.sub);

		await recordAudit(req, "LOGOUT_ALL", req.user.sub);
		res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not log you out of all devices. Please try again." });
	}
}

// POST /api/auth/forgot-password - sends a reset link when the email exists.
export async function forgotPasswordUser(req: Request, res: Response) {
	const result = forgotPasswordSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await forgotPassword(result.data.email);

		await recordAudit(req, "PASSWORD_RESET_REQUESTED", undefined, result.data.email);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not send the reset link. Please try again." });
	}
}

// POST /api/auth/reset-password - sets a new password with a reset token.
export async function resetPasswordUser(req: Request, res: Response) {
	const result = resetPasswordSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await resetPassword(result.data.token, result.data.newPassword);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAudit(req, "PASSWORD_RESET", response.userId);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not reset your password. Please try again." });
	}
}

// POST /api/auth/phone/change/request - sends a code before a rider changes phone.
export async function requestPhoneChangeCode(req: Request, res: Response) {
	const result = phoneChangeRequestSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	if (!req.user) {
		res.status(401).json({ message: "You must be logged in to change your phone number." });
		return;
	}

	try {
		const response = await requestPhoneChange(req.user.sub, result.data.phone);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAudit(req, "PHONE_CHANGE_REQUESTED", req.user.sub, result.data.phone);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not send the phone code. Please try again." });
	}
}

// POST /api/auth/phone/change/verify - verifies the code and updates the phone.
export async function verifyPhoneChangeCode(req: Request, res: Response) {
	const result = phoneChangeVerifySchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	if (!req.user) {
		res.status(401).json({ message: "You must be logged in to change your phone number." });
		return;
	}

	try {
		const response = await verifyPhoneChange(
			req.user.sub,
			result.data.phone,
			result.data.code,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAudit(req, "PHONE_CHANGED", req.user.sub, result.data.phone);
		res.status(200).json({ message: response.message });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not change your phone number. Please try again." });
	}
}

// GET /api/auth/me - returns the signed-in user's profile.
export async function getMe(req: Request, res: Response) {
	if (!req.user) {
		res.status(401).json({ message: "You must be logged in to view your profile." });
		return;
	}

	try {
		const response = await getMeService(req.user.sub);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		res.status(200).json({ user: response.user });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load your profile. Please try again." });
	}
}
