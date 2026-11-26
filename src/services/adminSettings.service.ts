import { adminSettingsRepository } from "../repositories/adminSettings.repository.ts";

// Returns every platform setting.
export async function getSettings() {
	const settings = await adminSettingsRepository.list();

	return { settings };
}

// Saves a batch of settings and returns the full updated list.
export async function updateSettings(
	settings: { key: string; value: string }[],
	actorId: string,
) {
	await adminSettingsRepository.upsertMany(settings, actorId);

	return getSettings();
}
