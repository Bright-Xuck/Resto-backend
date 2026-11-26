import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_ENV = "MFA_ENCRYPTION_KEY";

// Reads the 32-byte key from the environment and fails loudly if it is wrong.
function getKey(): Buffer {
	const value = process.env[KEY_ENV];

	if (!value) {
		throw new Error(`${KEY_ENV} is missing from .env`);
	}

	const key = Buffer.from(value, "base64");

	if (key.length !== 32) {
		throw new Error(`${KEY_ENV} must be a base64-encoded 32-byte key`);
	}

	return key;
}

// Encrypts a TOTP secret with AES-256-GCM before it is stored.
export function encryptSecret(plainText: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
	const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();

	return [
		"v1",
		iv.toString("base64url"),
		tag.toString("base64url"),
		encrypted.toString("base64url"),
	].join(":");
}

// Decrypts a stored TOTP secret.
export function decryptSecret(value: string): string {
	const [version, ivText, tagText, dataText] = value.split(":");

	if (version !== "v1" || !ivText || !tagText || !dataText) {
		throw new Error("The stored MFA secret has an unknown format");
	}

	const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivText, "base64url"));
	decipher.setAuthTag(Buffer.from(tagText, "base64url"));

	return Buffer.concat([
		decipher.update(Buffer.from(dataText, "base64url")),
		decipher.final(),
	]).toString("utf8");
}
