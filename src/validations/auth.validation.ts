import { z } from "zod";

const email = z
	.string()
	.trim()
	.toLowerCase()
	.email("Enter a valid email address");

// Cameroon mobile numbers: +237 followed by 6 and eight more digits.
const phone = z
	.string()
	.trim()
	.regex(/^\+2376\d{8}$/, "Phone must be a Cameroon number like +2376XXXXXXXX");

const password = z.string().min(8, "Password must be at least 8 characters");

// Allows Cameroon names with French accents, spaces, apostrophes and hyphens.
const fullName = z
	.string()
	.trim()
	.min(2, "Full name is required")
	.max(80, "Full name is too long")
	.regex(/^[A-Za-zÀ-ÿ' -]+$/, "Full name contains invalid characters");

// Cameroon uses English and French.
const locale = z.enum(["en", "fr"]).default("en");

// The user must explicitly accept the terms of service.
const acceptedTerms = z
	.boolean()
	.refine((value) => value === true, {
		message: "You must accept the terms of service.",
	});

// Body for creating a customer or merchant account.
export const registerSchema = z.object({
	fullName,
	email,
	password,
	type: z.enum(["CUSTOMER", "MERCHANT"]),
	locale,
	acceptedTerms,
});

// Body for requesting a rider signup code.
export const requestOtpSchema = z.object({
	phone,
});

// Body for verifying a rider phone number and creating the account.
export const registerRiderSchema = z.object({
	fullName,
	phone,
	code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
	password,
	email: email.optional(),
	locale,
	acceptedTerms,
});

// Body for logging in with either an email or a phone number.
export const loginSchema = z
	.object({
		email: email.optional(),
		phone: phone.optional(),
		password: z.string().min(1, "Password is required"),
	})
	.refine((data) => Boolean(data.email || data.phone), {
		message: "Email or phone is required",
	});

// Body for requesting a password reset email.
export const forgotPasswordSchema = z.object({
	email,
});

// Body for setting a new password with a reset token.
export const resetPasswordSchema = z.object({
	token: z.string().min(20, "Reset token is required"),
	newPassword: password,
});

// Body for requesting a rider phone-change code.
export const phoneChangeRequestSchema = z.object({
	phone,
});

// Body for verifying a rider phone-change code.
export const phoneChangeVerifySchema = z.object({
	phone,
	code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const mfaToken = z.string().min(20, "The confirmation token is missing");

const authenticatorCode = z
	.string()
	.trim()
	.min(6, "Enter the six-digit authenticator code")
	.max(12, "Enter the six-digit authenticator code");

// Body for starting admin two-factor setup.
export const adminMfaSetupSchema = z.object({ mfaToken });

// Body for confirming the first authenticator code.
export const adminMfaEnableSchema = z.object({
	mfaToken,
	code: authenticatorCode,
});

// Body for completing an admin login.
export const adminMfaVerifySchema = z.object({
	mfaToken,
	code: authenticatorCode,
});

// Body for turning two-factor authentication off.
export const adminMfaDisableSchema = z.object({
	password: z.string().min(1, "Password is required"),
	code: authenticatorCode,
});

// Body for confirming a sensitive admin action.
export const adminStepUpSchema = z.object({ code: authenticatorCode });
