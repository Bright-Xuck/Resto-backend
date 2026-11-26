import { createHash, randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { adminIdempotencyRepository } from "../repositories/adminIdempotency.repository.ts";

const KEY_TTL_HOURS = 24;
const MAX_KEY_LENGTH = 200;

// Hashes the request body so the same key cannot be reused for a different action.
function hashBody(body: unknown): string {
	return createHash("sha256").update(JSON.stringify(body ?? {})).digest("hex");
}

// Replays the first successful response when a mutation is retried.
// Place this after authenticate() and before the controller on money/decision routes.
export async function requireIdempotency(req: Request, res: Response, next: NextFunction) {
	const userId = req.user?.sub;

	if (!userId) {
		res.status(401).json({ message: "You must be logged in as an admin." });
		return;
	}

	const rawKey = req.header("Idempotency-Key");

	if (!rawKey || rawKey.trim().length === 0) {
		res.status(400).json({
			message: "This request needs an Idempotency-Key header so it can be retried safely.",
		});
		return;
	}

	if (rawKey.length > MAX_KEY_LENGTH) {
		res.status(400).json({ message: "The Idempotency-Key header is too long." });
		return;
	}

	const key = rawKey.trim();
	const route = `${req.method} ${req.baseUrl}${req.path}`;
	const requestHash = hashBody(req.body);

	try {
		const existing = await adminIdempotencyRepository.find(userId, route, key);

		if (existing && existing.expiresAt <= new Date()) {
			await adminIdempotencyRepository.remove(existing.id);
		} else if (existing) {
			if (existing.requestHash !== requestHash) {
				res.status(409).json({
					message: "This Idempotency-Key was already used with a different request.",
				});
				return;
			}

			// A row without a stored response means the first request is still running.
			if (existing.responseStatus === null || existing.responseBody === null) {
				res.status(409).json({
					message: "A request with this Idempotency-Key is already being processed.",
				});
				return;
			}

			res
				.status(existing.responseStatus)
				.json(JSON.parse(existing.responseBody) as Record<string, unknown>);
			return;
		}

		const recordId = randomUUID();

		await adminIdempotencyRepository.create({
			id: recordId,
			userId,
			route,
			key,
			requestHash,
			expiresAt: new Date(Date.now() + KEY_TTL_HOURS * 60 * 60 * 1000),
		});

		// Wrap res.json so the first response is saved for replay.
		const originalJson = res.json.bind(res);
		res.json = ((body: unknown) => {
			const status = res.statusCode;

			// Failures are removed so the client can retry with the same key.
			if (status >= 200 && status < 300) {
				void adminIdempotencyRepository
					.saveResponse(recordId, status, JSON.stringify(body))
					.catch((error) => console.error("Idempotency save failed:", error));
			} else {
				void adminIdempotencyRepository
					.remove(recordId)
					.catch((error) => console.error("Idempotency cleanup failed:", error));
			}

			return originalJson(body);
		}) as Response["json"];

		next();
	} catch (error) {
		// Two identical requests can race on the unique index.
		if ((error as { code?: string }).code === "P2002") {
			res.status(409).json({
				message: "A request with this Idempotency-Key is already being processed.",
			});
			return;
		}

		console.error(error);
		res.status(500).json({ message: "We could not process this request safely. Please try again." });
	}
}
