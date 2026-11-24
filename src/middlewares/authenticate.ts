import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessTokenUser } from "../util/tokens.ts";

declare global {
	namespace Express {
		interface Request {
			user?: AccessTokenUser;
		}
	}
}

// Reads the access token from the Authorization header and adds the user to req.user.
export function authenticate(req: Request, res: Response, next: NextFunction) {
	const authHeader = req.headers.authorization;

	// No token was sent.
	if (!authHeader) {
		res.status(401).json({ message: "The access token is missing." });
		return;
	}

	// The header is not in the expected Bearer format.
	if (!authHeader.startsWith("Bearer ")) {
		res.status(401).json({ message: "The authorization header must use Bearer <token>." });
		return;
	}

	// The token is invalid, expired, or signed with the wrong secret.
	try {
		req.user = verifyAccessToken(authHeader.slice("Bearer ".length));
	} catch {
		res.status(401).json({ message: "The access token is invalid or has expired." });
		return;
	}

	next();
}
