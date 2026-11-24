import { prisma } from "../config/prisma.ts";
import type {
	EmailTokenPurpose,
	PhoneOtpPurpose,
	User,
	UserType,
} from "../generated/prisma/client.ts";

type Bytes = Uint8Array<ArrayBuffer>;

type NewUser = {
	id: string;
	type: UserType;
	email: string | null;
	phone: string | null;
	passwordHash: string;
	fullName: string;
	locale: string;
	phoneVerifiedAt?: Date | null;
};

type NewConsent = {
	id: string;
	document: string;
	version: string;
};

type NewRefreshToken = {
	id: string;
	userId: string;
	familyId: string;
	tokenHash: Bytes;
	deviceId: string | null;
	expiresAt: Date;
};

export const authRepository = {
	// Finds a user by email, ignoring case.
	findUserByEmail(email: string) {
		return prisma.user.findFirst({
			where: {
				email: { equals: email, mode: "insensitive" },
				deletedAt: null,
			},
		});
	},

	// Finds a user by phone number.
	findUserByPhone(phone: string) {
		return prisma.user.findFirst({
			where: { phone, deletedAt: null },
		});
	},

	// Finds a user by id.
	findUserById(id: string) {
		return prisma.user.findFirst({
			where: { id, deletedAt: null },
		});
	},

	// Creates a user and records their terms consent in one transaction.
	createUserWithConsent(data: NewUser, consent: NewConsent) {
		return prisma.$transaction(async (tx) => {
			const user = await tx.user.create({ data });

			await tx.userConsent.create({
				data: {
					id: consent.id,
					userId: user.id,
					document: consent.document,
					version: consent.version,
				},
			});

			return user;
		});
	},

	// Marks the OTP as used and creates the rider with consent in one transaction.
	async createRiderWithOtp(
		otpId: string,
		data: NewUser,
		consent: NewConsent,
	): Promise<User | null> {
		return prisma.$transaction(async (tx) => {
			const used = await tx.phoneOtp.updateMany({
				where: { id: otpId, usedAt: null },
				data: { usedAt: new Date() },
			});

			if (used.count === 0) {
				return null;
			}

			const user = await tx.user.create({ data });

			await tx.userConsent.create({
				data: {
					id: consent.id,
					userId: user.id,
					document: consent.document,
					version: consent.version,
				},
			});

			return user;
		});
	},

	// Finds an unused, unexpired OTP for a phone number and purpose.
	findOtp(phone: string, purpose: PhoneOtpPurpose) {
		return prisma.phoneOtp.findFirst({
			where: {
				phone,
				purpose,
				usedAt: null,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: "desc" },
		});
	},

	// Finds the newest OTP for a phone number and purpose, even if used or expired.
	findLatestOtp(phone: string, purpose: PhoneOtpPurpose) {
		return prisma.phoneOtp.findFirst({
			where: { phone, purpose },
			orderBy: { createdAt: "desc" },
		});
	},

	// Stores a new hashed OTP for the given purpose.
	createOtp(data: {
		id: string;
		phone: string;
		purpose: PhoneOtpPurpose;
		codeHash: Bytes;
		expiresAt: Date;
	}) {
		return prisma.phoneOtp.create({ data });
	},

	// Marks an OTP as used so it cannot be reused.
	closeOtp(id: string) {
		return prisma.phoneOtp.updateMany({
			where: { id, usedAt: null },
			data: { usedAt: new Date() },
		});
	},

	// Counts one wrong OTP attempt and returns the updated row.
	incrementOtpAttempts(id: string) {
		return prisma.phoneOtp.update({
			where: { id },
			data: { attempts: { increment: 1 } },
		});
	},

	// Stores a hashed refresh token.
	createRefreshToken(data: NewRefreshToken) {
		return prisma.refreshToken.create({ data });
	},

	// Finds a refresh token by its hash and includes the owner.
	findRefreshToken(tokenHash: Bytes) {
		return prisma.refreshToken.findUnique({
			where: { tokenHash },
			include: { user: true },
		});
	},

	// Marks the old token used and stores its replacement in one transaction.
	async rotateRefreshToken(oldId: string, data: NewRefreshToken): Promise<boolean> {
		return prisma.$transaction(async (tx) => {
			const used = await tx.refreshToken.updateMany({
				where: { id: oldId, usedAt: null, revokedAt: null },
				data: { usedAt: new Date() },
			});

			if (used.count === 0) {
				return false;
			}

			await tx.refreshToken.create({ data });
			return true;
		});
	},

	// Marks one refresh token as revoked.
	revokeRefreshToken(id: string, reason: string) {
		return prisma.refreshToken.update({
			where: { id },
			data: { revokedAt: new Date(), revokedReason: reason },
		});
	},

	// Revokes every token in one token family (used when reuse is detected).
	revokeTokenFamily(familyId: string, reason: string) {
		return prisma.refreshToken.updateMany({
			where: { familyId, revokedAt: null },
			data: { revokedAt: new Date(), revokedReason: reason },
		});
	},

	// Revokes every active refresh token for one user.
	revokeAllRefreshTokens(userId: string, reason: string) {
		return prisma.refreshToken.updateMany({
			where: { userId, revokedAt: null },
			data: { revokedAt: new Date(), revokedReason: reason },
		});
	},

	// Stores the latest failed login count and lock time.
	recordFailedLogin(userId: string, failedAttempts: number, lockedUntil: Date | null) {
		return prisma.user.update({
			where: { id: userId },
			data: { failedAttempts, lockedUntil },
		});
	},

	// Clears the failed login count after a successful login.
	resetFailedLogin(userId: string) {
		return prisma.user.update({
			where: { id: userId },
			data: { failedAttempts: 0, lockedUntil: null },
		});
	},

	// Stores a new hashed email token.
	createEmailToken(data: {
		id: string;
		userId: string;
		purpose: EmailTokenPurpose;
		tokenHash: Bytes;
		expiresAt: Date;
	}) {
		return prisma.emailToken.create({ data });
	},

	// Finds an unused, unexpired email token for a purpose.
	findEmailToken(tokenHash: Bytes, purpose: EmailTokenPurpose) {
		return prisma.emailToken.findFirst({
			where: {
				tokenHash,
				purpose,
				usedAt: null,
				expiresAt: { gt: new Date() },
			},
		});
	},

	// Marks every open email token for a purpose as used.
	invalidateEmailTokens(userId: string, purpose: EmailTokenPurpose) {
		return prisma.emailToken.updateMany({
			where: { userId, purpose, usedAt: null },
			data: { usedAt: new Date() },
		});
	},

	// Changes the password, clears lockouts and revokes sessions in one transaction.
	async resetPasswordWithToken(
		tokenId: string,
		userId: string,
		passwordHash: string,
	): Promise<boolean> {
		return prisma.$transaction(async (tx) => {
			const used = await tx.emailToken.updateMany({
				where: { id: tokenId, usedAt: null },
				data: { usedAt: new Date() },
			});

			if (used.count === 0) {
				return false;
			}

			await tx.user.update({
				where: { id: userId },
				data: { passwordHash, failedAttempts: 0, lockedUntil: null },
			});

			await tx.refreshToken.updateMany({
				where: { userId, revokedAt: null },
				data: { revokedAt: new Date(), revokedReason: "PASSWORD_RESET" },
			});

			return true;
		});
	},

	// Consumes the OTP and changes the rider phone in one transaction.
	async changePhoneWithOtp(otpId: string, userId: string, phone: string): Promise<boolean> {
		return prisma.$transaction(async (tx) => {
			const used = await tx.phoneOtp.updateMany({
				where: { id: otpId, usedAt: null },
				data: { usedAt: new Date() },
			});

			if (used.count === 0) {
				return false;
			}

			await tx.user.update({
				where: { id: userId },
				data: { phone, phoneVerifiedAt: new Date() },
			});

			return true;
		});
	},

	// Stores one audit log row.
	createAuditLog(data: {
		id: string;
		userId: string | null;
		action: string;
		details: string | null;
		ip: string | null;
		userAgent: string | null;
	}) {
		return prisma.auditLog.create({ data });
	},
};
