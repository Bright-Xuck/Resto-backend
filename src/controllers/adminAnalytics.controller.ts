import type { Request, Response } from "express";
import { getAnalytics, getReconciliation } from "../services/adminAnalytics.service.ts";
import { recordAdminAudit } from "../services/audit.service.ts";
import { getSettings, updateSettings } from "../services/adminSettings.service.ts";
import {
	analyticsQuerySchema,
	settingsUpdateSchema,
} from "../validations/admin.validation.ts";

const DEFAULT_RANGE_DAYS = 30;

// GET /api/admin/analytics - returns the KPI dashboard for a date range.
export async function getAnalyticsReport(req: Request, res: Response) {
	const result = analyticsQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	const to = result.data.to ?? new Date();
	const from =
		result.data.from ??
		new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

	if (from > to) {
		res.status(400).json({ message: "The from date must be before the to date." });
		return;
	}

	try {
		const analytics = await getAnalytics(from, to);
		res.status(200).json(analytics);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the analytics. Please try again." });
	}
}

// GET /api/admin/reconciliation - returns payment and refund totals for finance.
export async function getReconciliationReport(req: Request, res: Response) {
	try {
		const reconciliation = await getReconciliation();
		res.status(200).json(reconciliation);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the reconciliation report. Please try again." });
	}
}

// GET /api/admin/settings - returns every platform setting.
export async function getPlatformSettings(req: Request, res: Response) {
	try {
		const response = await getSettings();
		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the settings. Please try again." });
	}
}

// PUT /api/admin/settings - updates one or more platform settings.
export async function updatePlatformSettings(req: Request, res: Response) {
	const result = settingsUpdateSchema.safeParse(req.body);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await updateSettings(result.data.settings, req.user!.sub);

		await recordAdminAudit(req, {
			action: "SETTINGS_UPDATED",
			actorId: req.user!.sub,
			targetType: "PlatformSetting",
			details: JSON.stringify(result.data.settings),
		});

		res.status(200).json({
			message: "The settings have been updated.",
			settings: response.settings,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not update the settings. Please try again." });
	}
}
