import type { ModerationReportStatus, RestaurantStatus } from "../generated/prisma/client.ts";
import {
	adminModerationRepository,
	type ModerationAction,
} from "../repositories/adminModeration.repository.ts";

// A failed admin call with the HTTP status and a client-friendly message.
export type ModerationFailure = { ok: false; status: number; message: string };

// Lists one page of moderation reports with their target content.
export async function listReports(
	status: ModerationReportStatus | undefined,
	page: number,
	limit: number,
) {
	const { reports, total } = await adminModerationRepository.list(status, page, limit);

	return { reports, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Applies flag, hide, restore or remove to the reported content and closes the report.
export async function moderateReport(
	reportId: string,
	action: ModerationAction,
	note: string,
	actorId: string,
): Promise<{ ok: true; report: unknown } | ModerationFailure> {
	const report = await adminModerationRepository.findReport(reportId);

	if (!report) {
		return { ok: false, status: 404, message: "That report does not exist." };
	}

	if (report.status === "RESOLVED") {
		return { ok: false, status: 409, message: "This report has already been resolved." };
	}

	// A restaurant has no flagged state, only approved or suspended.
	if (report.targetType === "RESTAURANT" && action === "FLAG") {
		return {
			ok: false,
			status: 400,
			message: "Restaurants can be hidden or restored, not flagged.",
		};
	}

	// The reported content may have been deleted since the report was filed.
	if (report.targetType === "MENU_ITEM") {
		const item = await adminModerationRepository.findMenuItem(report.targetId);

		if (!item) {
			return {
				ok: false,
				status: 409,
				message: "The reported menu item no longer exists.",
			};
		}
	} else {
		const restaurant = await adminModerationRepository.findRestaurant(report.targetId);

		if (!restaurant) {
			return {
				ok: false,
				status: 409,
				message: "The reported restaurant no longer exists.",
			};
		}
	}

	const updated = await adminModerationRepository.applyAction({
		reportId,
		targetType: report.targetType,
		targetId: report.targetId,
		action,
		note,
		actorId,
	});

	if (!updated) {
		return { ok: false, status: 409, message: "This report has already been resolved." };
	}

	return { ok: true, report: updated };
}

// Lists restaurants so support can suspend or restore a listing.
export async function listRestaurants(
	filters: { q?: string; status?: RestaurantStatus },
	page: number,
	limit: number,
) {
	const { restaurants, total } = await adminModerationRepository.listRestaurants(
		filters,
		page,
		limit,
	);

	return { restaurants, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// Changes a restaurant's listing status.
export async function changeRestaurantStatus(
	id: string,
	status: RestaurantStatus,
): Promise<{ ok: true; restaurant: unknown } | ModerationFailure> {
	const restaurant = await adminModerationRepository.findRestaurant(id);

	if (!restaurant) {
		return { ok: false, status: 404, message: "That restaurant does not exist." };
	}

	const updated = await adminModerationRepository.updateRestaurantStatus(id, status);

	return { ok: true, restaurant: updated };
}

// Loads one restaurant with its owner and menu.
export async function getRestaurantDetail(id: string) {
	const restaurant = await adminModerationRepository.findRestaurantDetail(id);

	if (!restaurant) {
		return { ok: false as const, status: 404, message: "That restaurant does not exist." };
	}

	return { ok: true as const, restaurant };
}

// Edits the name, price or availability of a menu item.
export async function editMenuItem(
	id: string,
	changes: { name?: string; priceFcfa?: number; isAvailable?: boolean },
): Promise<{ ok: true; menuItem: unknown } | ModerationFailure> {
	const menuItem = await adminModerationRepository.findMenuItem(id);

	if (!menuItem) {
		return { ok: false, status: 404, message: "That menu item does not exist." };
	}

	const updated = await adminModerationRepository.updateMenuItem(id, changes);

	return { ok: true, menuItem: updated };
}
