import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { authRepository } from "../repositories/auth.repository.ts";

// Writes one audit row. A logging failure must never break the auth request.
export async function recordAudit(
	req: Request,
	action: string,
	userId?: string,
	details?: string,
) {
	try {
		await authRepository.createAuditLog({
			id: randomUUID(),
			userId: userId ?? null,
			action,
			details: details ?? null,
			ip: req.ip ?? null,
			userAgent:
				typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
		});
	} catch (error) {
		console.error("Audit log failed:", error);
	}
}
