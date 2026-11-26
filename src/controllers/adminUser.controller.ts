import type { Request, Response } from "express";
import type { AdminRole } from "../generated/prisma/client.ts";
import { recordAdminAudit } from "../services/audit.service.ts";
import { hasValidStepUp } from "../middlewares/requireStepUp.ts";
import {
	changeAdminRole,
	changeUserStatus,
	createAdmin,
	getUser,
	listAdmins,
	listUsers,
	resetUserCredentials,
	type AdminActor,
} from "../services/adminUser.service.ts";
import {
	adminRoleSchema,
	createAdminSchema,
	idParamSchema,
	userListQuerySchema,
	userStatusSchema,
} from "../validations/admin.validation.ts";

// Role guards already ran, so the admin role is always present here.
function getActor(req: Request): AdminActor {
	return {
		id: req.user!.sub,
		adminRole: req.user!.adminRole as AdminRole,
	};
}

// GET /api/admin/users - searches accounts across every role.
export async function getUsers(req: Request, res: Response) {
	const result = userListQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await listUsers(
			{ q: result.data.q, type: result.data.type, status: result.data.status },
			result.data.page,
			result.data.limit,
		);

		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the accounts. Please try again." });
	}
}

// GET /api/admin/users/:id - returns one account with wallet and activity counts.
export async function getUserById(req: Request, res: Response) {
	const result = idParamSchema.safeParse(req.params);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await getUser(result.data.id);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		res.status(200).json({ user: response.user });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load that account. Please try again." });
	}
}

// PATCH /api/admin/users/:id/status - suspends, bans or reactivates an account.
export async function updateUserStatus(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = userStatusSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	// A permanent ban is irreversible from the dashboard, so it needs a fresh code.
	if (body.data.status === "BANNED" && !hasValidStepUp(req)) {
		res.status(403).json({
			message: "Confirm this ban with your authenticator code first.",
		});
		return;
	}

	try {
		const response = await changeUserStatus(
			getActor(req),
			params.data.id,
			body.data.status,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "USER_STATUS_CHANGED",
			actorId: getActor(req).id,
			targetType: "User",
			targetId: params.data.id,
			details: JSON.stringify({ status: body.data.status, reason: body.data.reason }),
		});

		res.status(200).json({
			message: "The account status has been updated.",
			user: response.user,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not update that account. Please try again." });
	}
}

// POST /api/admin/users/:id/credential-reset - issues a one-time temporary password.
export async function resetCredentials(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	try {
		const response = await resetUserCredentials(getActor(req), params.data.id);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "USER_CREDENTIAL_RESET",
			actorId: getActor(req).id,
			targetType: "User",
			targetId: params.data.id,
		});

		res.status(200).json({
			message: "The password was reset. Share the temporary password securely.",
			temporaryPassword: response.temporaryPassword,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not reset those credentials. Please try again." });
	}
}

// GET /api/admin/admins - lists admin accounts for the super admin staff screen.
export async function getAdmins(req: Request, res: Response) {
	const result = userListQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await listAdmins(result.data.page, result.data.limit);
		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the admin accounts. Please try again." });
	}
}

// POST /api/admin/admins - creates another admin account.
export async function createAdminAccount(req: Request, res: Response) {
	const result = createAdminSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await createAdmin(result.data);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "ADMIN_ACCOUNT_CREATED",
			actorId: getActor(req).id,
			targetType: "User",
			targetId: response.user.id,
			details: JSON.stringify({ adminRole: response.user.adminRole }),
		});

		res.status(201).json({
			message: "The admin account has been created. They must set up two-factor authentication at first login.",
			user: response.user,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not create that admin account. Please try again." });
	}
}

// PATCH /api/admin/admins/:id/role - changes an admin's sub-role.
export async function updateAdminRole(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = adminRoleSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await changeAdminRole(
			getActor(req),
			params.data.id,
			body.data.adminRole,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "ADMIN_ROLE_CHANGED",
			actorId: getActor(req).id,
			targetType: "User",
			targetId: params.data.id,
			details: JSON.stringify({ adminRole: body.data.adminRole }),
		});

		res.status(200).json({
			message: "The admin role has been updated. They must log in again.",
			user: response.user,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not update that admin role. Please try again." });
	}
}
