import type { Request, Response } from "express";
import { recordAdminAudit } from "../services/audit.service.ts";
import {
	decideApplication,
	getApplication,
	listApplications,
} from "../services/adminApplication.service.ts";
import {
	applicationDecisionSchema,
	applicationParamsSchema,
	applicationQuerySchema,
} from "../validations/admin.validation.ts";

// GET /api/admin/applications - returns the merchant or rider review queue.
export async function getApplications(req: Request, res: Response) {
	const result = applicationQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await listApplications(
			result.data.type,
			result.data.status,
			result.data.page,
			result.data.limit,
		);

		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the applications. Please try again." });
	}
}

// GET /api/admin/applications/:type/:id - returns one application with its documents.
export async function getApplicationById(req: Request, res: Response) {
	const result = applicationParamsSchema.safeParse(req.params);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await getApplication(result.data.type, result.data.id);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		res.status(200).json({ application: response.application });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load that application. Please try again." });
	}
}

// POST /api/admin/applications/:type/:id/decision - approves or rejects with a note.
export async function decideApplicationById(req: Request, res: Response) {
	const params = applicationParamsSchema.safeParse(req.params);
	const body = applicationDecisionSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await decideApplication(
			params.data.type,
			params.data.id,
			body.data.decision,
			body.data.note,
			req.user!.sub,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		const approved = body.data.decision === "APPROVE";

		await recordAdminAudit(req, {
			action: approved ? "APPLICATION_APPROVED" : "APPLICATION_REJECTED",
			actorId: req.user!.sub,
			targetType: params.data.type === "merchant" ? "MerchantApplication" : "RiderApplication",
			targetId: params.data.id,
			details: body.data.note,
		});

		res.status(200).json({
			message: approved
				? "The application has been approved."
				: "The application has been rejected.",
			application: response.application,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not save that decision. Please try again." });
	}
}
