import { Redis } from "@upstash/redis";
import type { NextFunction, Request, Response } from "express";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Rate limiting is skipped when Upstash is not configured (for example locally).
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

if (!redis) {
	console.warn("[rate-limit] Upstash Redis is not configured; rate limiting is disabled.");
}

// Creates a simple fixed-window rate limiter for one route group.
export function rateLimit(limit: number, windowSeconds: number, prefix: string) {
	return async (req: Request, res: Response, next: NextFunction) => {
		if (!redis) {
			next();
			return;
		}

		const ip = req.ip ?? "unknown";
		const key = `rate-limit:${prefix}:${ip}`;

		try {
			const count = await redis.incr(key);

			// Start the window on the first request in this period.
			if (count === 1) {
				await redis.expire(key, windowSeconds);
			}

			if (count > limit) {
				res.status(429).json({
					message: "Too many requests. Please try again later.",
				});
				return;
			}

			next();
		} catch (error) {
			// A Redis failure must not block users from logging in.
			console.error("Rate limit check failed:", error);
			next();
		}
	};
}
