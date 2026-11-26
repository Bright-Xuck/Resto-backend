import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.ts";

// Reads wallets and applies manual balance adjustments from finance.
export const adminWalletRepository = {
	// Loads a wallet with its owner and the latest ledger entries.
	findDetail(id: string) {
		return prisma.wallet.findUnique({
			where: { id },
			include: {
				user: { select: { id: true, fullName: true, email: true, phone: true, type: true } },
				entries: {
					orderBy: { createdAt: "desc" },
					take: 50,
					include: { createdBy: { select: { id: true, fullName: true } } },
				},
			},
		});
	},

	// Adds the adjustment to the balance and writes the ledger row together.
	adjust(input: {
		walletId: string;
		amountFcfa: number;
		reason: string;
		actorId: string;
	}) {
		return prisma.$transaction(async (tx) => {
			if (input.amountFcfa < 0) {
				// Atomic check: only take money out when the balance covers it.
				const changed = await tx.wallet.updateMany({
					where: {
						id: input.walletId,
						balanceFcfa: { gte: -input.amountFcfa },
					},
					data: { balanceFcfa: { increment: input.amountFcfa } },
				});

				if (changed.count === 0) {
					return null;
				}
			} else {
				await tx.wallet.update({
					where: { id: input.walletId },
					data: { balanceFcfa: { increment: input.amountFcfa } },
				});
			}

			await tx.walletLedgerEntry.create({
				data: {
					id: randomUUID(),
					walletId: input.walletId,
					amountFcfa: input.amountFcfa,
					reason: input.reason,
					createdById: input.actorId,
				},
			});

			return tx.wallet.findUniqueOrThrow({ where: { id: input.walletId } });
		});
	},
};
