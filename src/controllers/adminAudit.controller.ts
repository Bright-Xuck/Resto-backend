import type { Request, Response } from "express";
import { listAuditLogs } from "../services/adminAudit.service.ts";
import { auditQuerySchema } from "../validations/admin.validation.ts";

// GET /api/admin/audit - returns the append-only admin audit log.
export async function getAuditLogs(req: Request, res: Response) {
	const result = auditQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	if (result.data.from && result.data.to && result.data.from > result.data.to) {
		res.status(400).json({ message: "The from date must be before the to date." });
		return;
	}

	try {
		const response = await listAuditLogs(
			{
				action: result.data.action,
				targetType: result.data.targetType,
				targetId: result.data.targetId,
				actorId: result.data.actorId,
				from: result.data.from,
				to: result.data.to,
			},
			result.data.page,
			result.data.limit,
		);

		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the audit log. Please try again." });
	}
}
