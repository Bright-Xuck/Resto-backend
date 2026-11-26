import { generateSecret, generateURI, verifySync } from "otplib";

const ISSUER = "Resto Admin";

// Allow 30 seconds of clock drift between the phone and the server.
const EPOCH_TOLERANCE_SECONDS = 30;

// Creates a new base32 TOTP secret for an admin.
export function createTotpSecret() {
	return generateSecret();
}

// Builds the otpauth:// URI that an authenticator app can scan.
export function buildTotpUri(label: string, secret: string) {
	return generateURI({ issuer: ISSUER, label, secret });
}

// Checks a six-digit code against the stored secret.
export function verifyTotpCode(secret: string, code: string) {
	if (!/^\d{6}$/.test(code)) {
		return false;
	}

	const result = verifySync({
		secret,
		token: code,
		epochTolerance: EPOCH_TOLERANCE_SECONDS,
	});

	return result.valid;
}
