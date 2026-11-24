import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient } from "../generated/prisma/client.ts";

const connectionString = process.env.DATABASE_URL;

// Stop early if the Neon connection string is missing.
if (!connectionString) {
	throw new Error("DATABASE_URL is missing. Add your Neon connection string to .env.");
}

// Neon needs a WebSocket implementation in Node.js.
neonConfig.webSocketConstructor = ws;

// Prisma talks to Neon through this adapter.
const adapter = new PrismaNeon({ connectionString });

// Reuse one client across hot reloads so each reload does not open a new Neon pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
