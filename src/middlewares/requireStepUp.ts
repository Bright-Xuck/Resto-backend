import type { NextFunction, Request, Response } from "express";

const STEP_UP_MINUTES = 5;

// True when the access token contains a confirmation younger than five minutes.
export function hasValidStepUp(req: Request): boolean {
	const stepUpAt = req.user?.stepUpAt;

	if (!stepUpAt) {
		return false;
	}

	return Date.now() - stepUpAt <= STEP_UP_MINUTES * 60 * 1000;
}

// Sensitive admin actions need a TOTP code confirmed in the last five minutes.
export function requireStepUp(req: Request, res: Response, next: NextFunction) {
	if (!hasValidStepUp(req)) {
		res.status(403).json({
			message: "Confirm this action with your authenticator code first.",
		});
		return;
	}

	next();
}
