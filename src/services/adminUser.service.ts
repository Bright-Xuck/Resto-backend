import { randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { AdminRole, UserStatus } from "../generated/prisma/client.ts";
import {
	adminUserRepository,
	type AdminPublicUser,
	type UserFilters,
} from "../repositories/adminUser.repository.ts";
import { authRepository } from "../repositories/auth.repository.ts";

// The signed-in admin's id and sub-role decide what they may change.
export type AdminActor = {
	id: string;
	adminRole: AdminRole;
};

// A failed admin call with the HTTP status and a client-friendly message.
export type AdminFailure = { ok: false; status: number; message: string };

// One page of accounts.
export async function listUsers(filters: UserFilters, page: number, limit: number) {
	const { users, total } = await adminUserRepository.list(filters, page, limit);

	return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Loads one account with wallet and activity counts.
export async function getUser(id: string) {
	const user = await adminUserRepository.findDetail(id);

	if (!user) {
		return {
			ok: false as const,
			status: 404,
			message: "That account does not exist.",
		};
	}

	return { ok: true as const, user };
}

// Suspends, bans or reactivates an account after permission checks.
export async function changeUserStatus(
	actor: AdminActor,
	targetId: string,
	status: UserStatus,
): Promise<{ ok: true; user: AdminPublicUser } | AdminFailure> {
	if (actor.id === targetId) {
		return {
			ok: false,
			status: 400,
			message: "You cannot change the status of your own account.",
		};
	}

	const target = await adminUserRepository.findById(targetId);

	if (!target) {
		return { ok: false, status: 404, message: "That account does not exist." };
	}

	// Only a super admin may touch another admin account.
	if (target.type === "ADMIN" && actor.adminRole !== "SUPER_ADMIN") {
		return {
			ok: false,
			status: 403,
			message: "Only a super admin can change another admin's account.",
		};
	}

	// Support can suspend, but a permanent ban is reserved for super admins.
	if (status === "BANNED" && actor.adminRole !== "SUPER_ADMIN") {
		return {
			ok: false,
			status: 403,
			message: "Only a super admin can permanently ban an account.",
		};
	}

	// Never lock the platform out of its last active super admin.
	if (target.type === "ADMIN" && target.adminRole === "SUPER_ADMIN" && status !== "ACTIVE") {
		const activeSuperAdmins = await adminUserRepository.countActiveSuperAdmins();

		if (activeSuperAdmins <= 1) {
			return {
				ok: false,
				status: 400,
				message: "You cannot deactivate the last active super admin.",
			};
		}
	}

	const user = await adminUserRepository.updateStatus(targetId, status);

	// A blocked account should not keep working sessions.
	if (status !== "ACTIVE") {
		await authRepository.revokeAllRefreshTokens(
			targetId,
			status === "BANNED" ? "ACCOUNT_BANNED" : "ACCOUNT_SUSPENDED",
		);
	}

	return { ok: true, user };
}

// Generates a temporary password, returns it once and signs the user out everywhere.
export async function resetUserCredentials(
	actor: AdminActor,
	targetId: string,
): Promise<{ ok: true; temporaryPassword: string } | AdminFailure> {
	const target = await adminUserRepository.findById(targetId);

	if (!target) {
		return { ok: false, status: 404, message: "That account does not exist." };
	}

	if (target.type === "ADMIN" && actor.adminRole !== "SUPER_ADMIN") {
		return {
			ok: false,
			status: 403,
			message: "Only a super admin can reset another admin's password.",
		};
	}

	const temporaryPassword = `Rst-${randomBytes(6).toString("base64url")}`;
	const passwordHash = await argon2.hash(temporaryPassword);

	await adminUserRepository.resetCredentials(targetId, passwordHash);

	return { ok: true, temporaryPassword };
}

// Lists admin accounts for the super admin staff screen.
export async function listAdmins(page: number, limit: number) {
	const [admins, total] = await adminUserRepository.listAdmins(page, limit);

	return { admins, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Creates a new admin account with a password that must be changed on first login.
export async function createAdmin(input: {
	email: string;
	fullName: string;
	password: string;
	adminRole: AdminRole;
}): Promise<{ ok: true; user: AdminPublicUser } | AdminFailure> {
	const existing = await adminUserRepository.findByEmail(input.email);

	if (existing) {
		return {
			ok: false,
			status: 409,
			message: "An account with this email already exists.",
		};
	}

	const passwordHash = await argon2.hash(input.password);

	const user = await adminUserRepository.createAdmin({
		id: randomUUID(),
		email: input.email,
		fullName: input.fullName,
		passwordHash,
		adminRole: input.adminRole,
	});

	return { ok: true, user };
}

// Changes an admin's sub-role and signs them out so old tokens cannot keep the old role.
export async function changeAdminRole(
	actor: AdminActor,
	targetId: string,
	adminRole: AdminRole,
): Promise<{ ok: true; user: AdminPublicUser } | AdminFailure> {
	const target = await adminUserRepository.findById(targetId);

	if (!target || target.type !== "ADMIN") {
		return { ok: false, status: 404, message: "That admin account does not exist." };
	}

	if (target.adminRole === "SUPER_ADMIN" && adminRole !== "SUPER_ADMIN") {
		const activeSuperAdmins = await adminUserRepository.countActiveSuperAdmins();

		if (activeSuperAdmins <= 1) {
			return {
				ok: false,
				status: 400,
				message: "You cannot remove the last super admin role.",
			};
		}
	}

	const user = await adminUserRepository.updateAdminRole(targetId, adminRole);

	await authRepository.revokeAllRefreshTokens(targetId, "ROLE_CHANGED");

	return { ok: true, user };
}
