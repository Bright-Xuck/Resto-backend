import type { ApplicationStatus } from "../generated/prisma/client.ts";
import {
	adminApplicationRepository,
	type ApplicationType,
} from "../repositories/adminApplication.repository.ts";

// A failed admin call with the HTTP status and a client-friendly message.
export type ApplicationFailure = { ok: false; status: number; message: string };

// Lists one page of merchant or rider applications.
export async function listApplications(
	type: ApplicationType,
	status: ApplicationStatus | undefined,
	page: number,
	limit: number,
) {
	const { applications, total } = await adminApplicationRepository.list(
		type,
		status,
		page,
		limit,
	);

	return {
		type,
		applications,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
}

// Loads one application and its documents.
export async function getApplication(type: ApplicationType, id: string) {
	if (type === "merchant") {
		const application = await adminApplicationRepository.findMerchant(id);

		if (!application) {
			return {
				ok: false as const,
				status: 404,
				message: "That merchant application does not exist.",
			};
		}

		return { ok: true as const, application };
	}

	const application = await adminApplicationRepository.findRider(id);

	if (!application) {
		return {
			ok: false as const,
			status: 404,
			message: "That rider application does not exist.",
		};
	}

	return { ok: true as const, application };
}

// Approves or rejects an application, then updates the restaurant or rider profile.
export async function decideApplication(
	type: ApplicationType,
	id: string,
	decision: "APPROVE" | "REJECT",
	note: string,
	reviewerId: string,
): Promise<{ ok: true; application: unknown } | ApplicationFailure> {
	const existing = await getApplication(type, id);

	if (!existing.ok) {
		return existing;
	}

	const status: ApplicationStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";

	const result =
		type === "merchant"
			? await adminApplicationRepository.decideMerchant({
					id,
					status,
					note,
					reviewerId,
					commissionPercent: await adminApplicationRepository.defaultCommissionPercent(),
				})
			: await adminApplicationRepository.decideRider({
					id,
					status,
					note,
					reviewerId,
				});

	// A null result means the row was not pending anymore.
	if (!result) {
		return {
			ok: false,
			status: 409,
			message: "This application has already been reviewed.",
		};
	}

	return { ok: true, application: result };
}
