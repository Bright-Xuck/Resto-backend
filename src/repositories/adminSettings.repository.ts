import { prisma } from "../config/prisma.ts";

// Reads and writes the platform settings edited by a super admin.
export const adminSettingsRepository = {
	list() {
		return prisma.platformSetting.findMany({ orderBy: { key: "asc" } });
	},

	// Saves every changed key and records who edited it.
	upsertMany(settings: { key: string; value: string }[], actorId: string) {
		return prisma.$transaction(
			settings.map((setting) =>
				prisma.platformSetting.upsert({
					where: { key: setting.key },
					create: { key: setting.key, value: setting.value, updatedById: actorId },
					update: { value: setting.value, updatedById: actorId },
				}),
			),
		);
	},
};
