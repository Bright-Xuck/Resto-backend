import { adminAuditRepository, type AuditLogFilters } from "../repositories/adminAudit.repository.ts";

// Returns one page of audit rows. Only super admins can call this.
export async function listAuditLogs(
	filters: AuditLogFilters,
	page: number,
	limit: number,
) {
	const { logs, total } = await adminAuditRepository.list(filters, page, limit);

	return {
		logs,
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
	};
}
