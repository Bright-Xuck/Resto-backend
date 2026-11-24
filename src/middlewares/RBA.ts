import type { NextFunction, Request, Response } from "express";

// Role guards only run after authenticate() has filled req.user.

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

// Allows only admins.
export function adminOnly(req: Request, res: Response, next: NextFunction) {
	if (req.user?.type !== "ADMIN") {
		res.status(403).json({ message: "This route is for admins only." });
		return;
	}

	next();
}
