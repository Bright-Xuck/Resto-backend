import type { NextFunction, Request, Response } from "express";
import type { AdminRole } from "../generated/prisma/client.ts";

// Role guards only run after authenticate() has filled req.user.

// True when the caller is an admin with one of the allowed sub-roles.
// SUPER_ADMIN passes every admin guard.
function hasAdminRole(req: Request, roles: AdminRole[]): boolean {
	const user = req.user;

	if (!user || user.type !== "ADMIN" || !user.adminRole) {
		return false;
	}

	return user.adminRole === "SUPER_ADMIN" || roles.includes(user.adminRole);
}

// Allows only customers.
export function customerOnly(req: Request, res: Response, next: NextFunction) {
	if (req.user?.type !== "CUSTOMER") {
		res.status(403).json({ message: "This route is for customers only." });
		return;
	}

	next();
}

// Allows only merchants.
export function merchantOnly(req: Request, res: Response, next: NextFunction) {
	if (req.user?.type !== "MERCHANT") {
		res.status(403).json({ message: "This route is for merchants only." });
		return;
	}

	next();
}

// Allows only riders.
export function riderOnly(req: Request, res: Response, next: NextFunction) {
	if (req.user?.type !== "RIDER") {
		res.status(403).json({ message: "This route is for riders only." });
		return;
	}

	next();
}

// Allows any admin account, whatever its sub-role.
export function adminOnly(req: Request, res: Response, next: NextFunction) {
	if (req.user?.type !== "ADMIN") {
		res.status(403).json({ message: "This route is for admins only." });
		return;
	}

	next();
}

// Allows SUPER_ADMIN only.
export function superAdminOnly(req: Request, res: Response, next: NextFunction) {
	if (!hasAdminRole(req, ["SUPER_ADMIN"])) {
		res.status(403).json({ message: "This route is for super admins only." });
		return;
	}

	next();
}

// Allows VERIFIER and SUPER_ADMIN.
export function verifierOnly(req: Request, res: Response, next: NextFunction) {
	if (!hasAdminRole(req, ["VERIFIER"])) {
		res.status(403).json({ message: "This route is for admin verifiers only." });
		return;
	}

	next();
}

// Allows SUPPORT and SUPER_ADMIN.
export function supportOnly(req: Request, res: Response, next: NextFunction) {
	if (!hasAdminRole(req, ["SUPPORT"])) {
		res.status(403).json({ message: "This route is for admin support staff only." });
		return;
	}

	next();
}

// Allows FINANCE and SUPER_ADMIN.
export function financeOnly(req: Request, res: Response, next: NextFunction) {
	if (!hasAdminRole(req, ["FINANCE"])) {
		res.status(403).json({ message: "This route is for admin finance staff only." });
		return;
	}

	next();
}

// Allows ANALYST and SUPER_ADMIN.
export function analystOnly(req: Request, res: Response, next: NextFunction) {
	if (!hasAdminRole(req, ["ANALYST"])) {
		res.status(403).json({ message: "This route is for admin analysts only." });
		return;
	}

	next();
}

// Allows SUPPORT, FINANCE and SUPER_ADMIN to view disputes.
export function supportOrFinanceOnly(req: Request, res: Response, next: NextFunction) {
	if (!hasAdminRole(req, ["SUPPORT", "FINANCE"])) {
		res.status(403).json({ message: "This route is for support and finance staff only." });
		return;
	}

	next();
}
