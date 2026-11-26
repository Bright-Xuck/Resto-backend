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

type AdminAuditInput = {
	action: string;
	actorId: string | null;
	targetType?: string;
	targetId?: string;
	details?: string;
};

// Writes an admin audit row with the actor and the affected record (NFR-11).
export async function recordAdminAudit(req: Request, input: AdminAuditInput) {
	try {
		await authRepository.createAuditLog({
			id: randomUUID(),
			userId: input.actorId,
			action: input.action,
			targetType: input.targetType ?? null,
			targetId: input.targetId ?? null,
			details: input.details ?? null,
			ip: req.ip ?? null,
			userAgent:
				typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
		});
	} catch (error) {
		console.error("Admin audit log failed:", error);
	}
}
