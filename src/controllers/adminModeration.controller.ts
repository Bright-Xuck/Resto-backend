import type { Request, Response } from "express";
import { recordAdminAudit } from "../services/audit.service.ts";
import {
	changeRestaurantStatus,
	editMenuItem,
	getRestaurantDetail,
	listReports,
	listRestaurants,
	moderateReport,
} from "../services/adminModeration.service.ts";
import {
	idParamSchema,
	menuItemUpdateSchema,
	moderationActionSchema,
	moderationQuerySchema,
	restaurantQuerySchema,
	restaurantStatusSchema,
} from "../validations/admin.validation.ts";

// GET /api/admin/moderation - returns reported content for review.
export async function getModerationQueue(req: Request, res: Response) {
	const result = moderationQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await listReports(
			result.data.status,
			result.data.page,
			result.data.limit,
		);

		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the moderation queue. Please try again." });
	}
}

// POST /api/admin/moderation/:id/action - flags, hides, restores or removes reported content.
export async function moderateReportById(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = moderationActionSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await moderateReport(
			params.data.id,
			body.data.action,
			body.data.note,
			req.user!.sub,
		);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "MODERATION_ACTION",
			actorId: req.user!.sub,
			targetType: "ModerationReport",
			targetId: params.data.id,
			details: JSON.stringify({ action: body.data.action, note: body.data.note }),
		});

		res.status(200).json({
			message: "The report has been resolved.",
			report: response.report,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not apply that moderation action. Please try again." });
	}
}

// GET /api/admin/restaurants - lists restaurants so support can suspend a listing.
export async function getRestaurants(req: Request, res: Response) {
	const result = restaurantQuerySchema.safeParse(req.query);

	if (!result.success) {
		res.status(400).json({ message: result.error.issues[0]?.message });
		return;
	}

	try {
		const response = await listRestaurants(
			{ q: result.data.q, status: result.data.status },
			result.data.page,
			result.data.limit,
		);

		res.status(200).json(response);
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load the restaurants. Please try again." });
	}
}

// PATCH /api/admin/restaurants/:id/status - suspends or restores a restaurant.
export async function updateRestaurantStatus(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = restaurantStatusSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await changeRestaurantStatus(params.data.id, body.data.status);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "RESTAURANT_STATUS_CHANGED",
			actorId: req.user!.sub,
			targetType: "Restaurant",
			targetId: params.data.id,
			details: JSON.stringify({ status: body.data.status, note: body.data.note }),
		});

		res.status(200).json({
			message: "The restaurant status has been updated.",
			restaurant: response.restaurant,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not update that restaurant. Please try again." });
	}
}

// GET /api/admin/restaurants/:id - returns one restaurant with its owner and menu.
export async function getRestaurantById(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	try {
		const response = await getRestaurantDetail(params.data.id);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		res.status(200).json({ restaurant: response.restaurant });
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not load that restaurant. Please try again." });
	}
}

// PATCH /api/admin/menu-items/:id - edits a menu item's name, price or availability.
export async function updateMenuItemById(req: Request, res: Response) {
	const params = idParamSchema.safeParse(req.params);
	const body = menuItemUpdateSchema.safeParse(req.body);

	if (!params.success) {
		res.status(400).json({ message: params.error.issues[0]?.message });
		return;
	}

	if (!body.success) {
		res.status(400).json({ message: body.error.issues[0]?.message });
		return;
	}

	try {
		const response = await editMenuItem(params.data.id, body.data);

		if (!response.ok) {
			res.status(response.status).json({ message: response.message });
			return;
		}

		await recordAdminAudit(req, {
			action: "MENU_ITEM_UPDATED",
			actorId: req.user!.sub,
			targetType: "MenuItem",
			targetId: params.data.id,
			details: JSON.stringify(body.data),
		});

		res.status(200).json({
			message: "The menu item has been updated.",
			menuItem: response.menuItem,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "We could not update that menu item. Please try again." });
	}
}
