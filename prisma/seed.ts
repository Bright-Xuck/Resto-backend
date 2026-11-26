import "dotenv/config";
import argon2 from "argon2";
import { prisma } from "../src/config/prisma.ts";

// Passwords for the demo accounts. Override with env variables in .env.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "AdminPass123!";
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "Password123!";

// Fixed UUIDs make the seed safe to run more than once.
const adminIds = {
	superAdmin: "0a000000-0000-4000-8000-000000000001",
	verifier: "0a000000-0000-4000-8000-000000000002",
	support: "0a000000-0000-4000-8000-000000000003",
	finance: "0a000000-0000-4000-8000-000000000004",
	analyst: "0a000000-0000-4000-8000-000000000005",
};

const customerIds = {
	alice: "0b000000-0000-4000-8000-000000000001",
	bob: "0b000000-0000-4000-8000-000000000002",
};

const merchantIds = {
	mamaNgo: "0c000000-0000-4000-8000-000000000001",
	chezTino: "0c000000-0000-4000-8000-000000000002",
	newbie: "0c000000-0000-4000-8000-000000000003",
};

const riderIds = {
	paul: "0d000000-0000-4000-8000-000000000001",
	eric: "0d000000-0000-4000-8000-000000000002",
};

const restaurantIds = {
	mamaNgo: "0e000000-0000-4000-8000-000000000001",
	chezTino: "0e000000-0000-4000-8000-000000000002",
};

const menuItemIds = {
	ndole: "0f000000-0000-4000-8000-000000000001",
	pouletDg: "0f000000-0000-4000-8000-000000000002",
	eru: "0f000000-0000-4000-8000-000000000003",
	beignets: "0f000000-0000-4000-8000-000000000004",
};

const orderIds = {
	completed: "10000000-0000-4000-8000-000000000001",
	inDelivery: "10000000-0000-4000-8000-000000000002",
	placed: "10000000-0000-4000-8000-000000000003",
};

const walletIds = {
	alice: "11000000-0000-4000-8000-000000000001",
	bob: "11000000-0000-4000-8000-000000000002",
	mamaNgo: "11000000-0000-4000-8000-000000000003",
	chezTino: "11000000-0000-4000-8000-000000000004",
	paul: "11000000-0000-4000-8000-000000000005",
	eric: "11000000-0000-4000-8000-000000000006",
};

// Creates the admin accounts, one per sub-role, so every guard can be tested.
async function seedAdmins() {
	const adminHash = await argon2.hash(ADMIN_PASSWORD);

	await prisma.user.createMany({
		skipDuplicates: true,
		data: [
			{
				id: adminIds.superAdmin,
				type: "ADMIN",
				adminRole: "SUPER_ADMIN",
				email: process.env.ADMIN_EMAIL ?? "admin@resto.local",
				passwordHash: adminHash,
				fullName: "Super Admin",
				locale: "en",
			},
			{
				id: adminIds.verifier,
				type: "ADMIN",
				adminRole: "VERIFIER",
				email: "verifier@resto.local",
				passwordHash: adminHash,
				fullName: "Bih Clarisse",
				locale: "fr",
			},
			{
				id: adminIds.support,
				type: "ADMIN",
				adminRole: "SUPPORT",
				email: "support@resto.local",
				passwordHash: adminHash,
				fullName: "Tchoumi Arnaud",
				locale: "fr",
			},
			{
				id: adminIds.finance,
				type: "ADMIN",
				adminRole: "FINANCE",
				email: "finance@resto.local",
				passwordHash: adminHash,
				fullName: "Ngono Marie",
				locale: "fr",
			},
			{
				id: adminIds.analyst,
				type: "ADMIN",
				adminRole: "ANALYST",
				email: "analyst@resto.local",
				passwordHash: adminHash,
				fullName: "Fotso Yannick",
				locale: "en",
			},
		],
	});
}

// Creates customers, merchants and riders used by the admin demo data.
async function seedPeople() {
	const userHash = await argon2.hash(DEMO_PASSWORD);

	await prisma.user.createMany({
		skipDuplicates: true,
		data: [
			{
				id: customerIds.alice,
				type: "CUSTOMER",
				email: "alice@example.com",
				phone: "+237677000001",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Alice Mbarga",
				locale: "fr",
			},
			{
				id: customerIds.bob,
				type: "CUSTOMER",
				email: "bob@example.com",
				phone: "+237677000002",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Bob Nkeng",
				locale: "en",
			},
			{
				id: merchantIds.mamaNgo,
				type: "MERCHANT",
				email: "mamango@example.com",
				phone: "+237677000003",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Mama Ngo",
				locale: "fr",
			},
			{
				id: merchantIds.chezTino,
				type: "MERCHANT",
				email: "cheztino@example.com",
				phone: "+237677000004",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Tino Fotso",
				locale: "fr",
			},
			{
				id: merchantIds.newbie,
				type: "MERCHANT",
				email: "rose@example.com",
				phone: "+237677000007",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Ateba Rose",
				locale: "fr",
			},
			{
				id: riderIds.paul,
				type: "RIDER",
				email: "paul@example.com",
				phone: "+237677000005",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Paul Etoundi",
				locale: "fr",
			},
			{
				id: riderIds.eric,
				type: "RIDER",
				email: "eric@example.com",
				phone: "+237677000006",
				phoneVerifiedAt: new Date(),
				passwordHash: userHash,
				fullName: "Eric Njoya",
				locale: "en",
			},
		],
	});

	// Rider profiles carry the vehicle and verification state shown in the admin app.
	await prisma.riderProfile.createMany({
		skipDuplicates: true,
		data: [
			{
				userId: riderIds.paul,
				vehicleType: "MOTORCYCLE",
				verificationStatus: "APPROVED",
			},
			{
				userId: riderIds.eric,
				vehicleType: "BICYCLE",
				verificationStatus: "PENDING",
			},
		],
	});
}

// Creates pending and approved applications so the review screens have data.
async function seedApplications() {
	await prisma.merchantApplication.createMany({
		skipDuplicates: true,
		data: [
			{
				id: "12000000-0000-4000-8000-000000000001",
				userId: merchantIds.mamaNgo,
				restaurantName: "Chez Mama Ngo",
				category: "Local dishes",
				phone: "+237677000003",
				address: "Mvog-Mbi, Yaounde",
				status: "APPROVED",
				decisionNote: "Documents checked and approved.",
				reviewedById: adminIds.verifier,
				reviewedAt: new Date(),
			},
			{
				id: "12000000-0000-4000-8000-000000000002",
				userId: merchantIds.chezTino,
				restaurantName: "Chez Tino Grill",
				category: "Grill",
				phone: "+237677000004",
				address: "Bonapriso, Douala",
				status: "PENDING",
			},
			{
				id: "12000000-0000-4000-8000-000000000003",
				userId: merchantIds.newbie,
				restaurantName: "Rose Fast Food",
				category: "Fast food",
				phone: "+237677000007",
				address: "Bastos, Yaounde",
				status: "PENDING",
			},
		],
	});

	await prisma.riderApplication.createMany({
		skipDuplicates: true,
		data: [
			{
				id: "13000000-0000-4000-8000-000000000001",
				userId: riderIds.paul,
				vehicleType: "MOTORCYCLE",
				status: "APPROVED",
				decisionNote: "Licence and bike papers verified.",
				reviewedById: adminIds.verifier,
				reviewedAt: new Date(),
			},
			{
				id: "13000000-0000-4000-8000-000000000002",
				userId: riderIds.eric,
				vehicleType: "BICYCLE",
				status: "PENDING",
			},
		],
	});
}

// Creates two restaurants and a small menu, including one flagged item.
async function seedCatalog() {
	await prisma.restaurant.createMany({
		skipDuplicates: true,
		data: [
			{
				id: restaurantIds.mamaNgo,
				ownerId: merchantIds.mamaNgo,
				name: "Chez Mama Ngo",
				category: "Local dishes",
				phone: "+237677000003",
				address: "Mvog-Mbi, Yaounde",
				status: "APPROVED",
				isOpen: true,
				commissionPercent: 10,
			},
			{
				id: restaurantIds.chezTino,
				ownerId: merchantIds.chezTino,
				name: "Chez Tino Grill",
				category: "Grill",
				phone: "+237677000004",
				address: "Bonapriso, Douala",
				status: "APPROVED",
				isOpen: false,
				commissionPercent: 12,
			},
		],
	});

	await prisma.menuItem.createMany({
		skipDuplicates: true,
		data: [
			{
				id: menuItemIds.ndole,
				restaurantId: restaurantIds.mamaNgo,
				name: "Ndole with plantain",
				priceFcfa: 2500,
			},
			{
				id: menuItemIds.pouletDg,
				restaurantId: restaurantIds.mamaNgo,
				name: "Poulet DG",
				priceFcfa: 3500,
			},
			{
				id: menuItemIds.eru,
				restaurantId: restaurantIds.mamaNgo,
				name: "Eru and water fufu",
				priceFcfa: 2000,
				moderationStatus: "FLAGGED",
				moderationNote: "A customer reported a missing price photo.",
			},
			{
				id: menuItemIds.beignets,
				restaurantId: restaurantIds.chezTino,
				name: "Beignets and beans",
				priceFcfa: 1000,
				isAvailable: false,
			},
		],
	});

	await prisma.moderationReport.createMany({
		skipDuplicates: true,
		data: [
			{
				id: "14000000-0000-4000-8000-000000000001",
				targetType: "MENU_ITEM",
				targetId: menuItemIds.eru,
				reason: "The photo does not match the dish.",
				status: "OPEN",
			},
		],
	});
}

// Creates orders in different states with payments so dashboards have numbers.
async function seedOrders() {
	await prisma.order.createMany({
		skipDuplicates: true,
		data: [
			{
				id: orderIds.completed,
				reference: "RST-DEMO-0001",
				customerId: customerIds.alice,
				restaurantId: restaurantIds.mamaNgo,
				riderId: riderIds.paul,
				status: "COMPLETED",
				totalFcfa: 6000,
				paymentMethod: "ONLINE",
				version: 2,
				placedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
				completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
			},
			{
				id: orderIds.inDelivery,
				reference: "RST-DEMO-0002",
				customerId: customerIds.bob,
				restaurantId: restaurantIds.mamaNgo,
				riderId: riderIds.paul,
				status: "OUT_FOR_DELIVERY",
				totalFcfa: 3500,
				paymentMethod: "ONLINE",
				version: 2,
				placedAt: new Date(Date.now() - 40 * 60 * 1000),
			},
			{
				id: orderIds.placed,
				reference: "RST-DEMO-0003",
				customerId: customerIds.alice,
				restaurantId: restaurantIds.chezTino,
				status: "PLACED",
				totalFcfa: 2000,
				paymentMethod: "COD",
				placedAt: new Date(Date.now() - 10 * 60 * 1000),
			},
		],
	});

	await prisma.orderEvent.createMany({
		skipDuplicates: true,
		data: [
			{
				id: "15000000-0000-4000-8000-000000000001",
				orderId: orderIds.completed,
				version: 1,
				status: "PLACED",
			},
			{
				id: "15000000-0000-4000-8000-000000000002",
				orderId: orderIds.completed,
				version: 2,
				status: "COMPLETED",
			},
			{
				id: "15000000-0000-4000-8000-000000000003",
				orderId: orderIds.inDelivery,
				version: 1,
				status: "PLACED",
			},
			{
				id: "15000000-0000-4000-8000-000000000004",
				orderId: orderIds.inDelivery,
				version: 2,
				status: "OUT_FOR_DELIVERY",
			},
			{
				id: "15000000-0000-4000-8000-000000000005",
				orderId: orderIds.placed,
				version: 1,
				status: "PLACED",
			},
		],
	});

	// Only online orders have a payment row; cash orders are paid on delivery.
	await prisma.payment.createMany({
		skipDuplicates: true,
		data: [
			{
				id: "16000000-0000-4000-8000-000000000001",
				orderId: orderIds.completed,
				state: "SUCCEEDED",
				amountFcfa: 6000,
				provider: "MOCK",
				providerRef: "MOCK-0001",
			},
			{
				id: "16000000-0000-4000-8000-000000000002",
				orderId: orderIds.inDelivery,
				state: "SUCCEEDED",
				amountFcfa: 3500,
				provider: "MOCK",
				providerRef: "MOCK-0002",
			},
		],
	});
}

// Creates one wallet per demo user with a matching ledger entry.
async function seedWallets() {
	await prisma.wallet.createMany({
		skipDuplicates: true,
		data: [
			{ id: walletIds.alice, userId: customerIds.alice, balanceFcfa: 5000 },
			{ id: walletIds.bob, userId: customerIds.bob, balanceFcfa: 0 },
			{ id: walletIds.mamaNgo, userId: merchantIds.mamaNgo, balanceFcfa: 5400 },
			{ id: walletIds.chezTino, userId: merchantIds.chezTino, balanceFcfa: 0 },
			{ id: walletIds.paul, userId: riderIds.paul, balanceFcfa: 1200 },
			{ id: walletIds.eric, userId: riderIds.eric, balanceFcfa: 0 },
		],
	});

	await prisma.walletLedgerEntry.createMany({
		skipDuplicates: true,
		data: [
			{
				id: "17000000-0000-4000-8000-000000000001",
				walletId: walletIds.alice,
				amountFcfa: 5000,
				reason: "Top-up",
				reference: "RST-DEMO-0001",
			},
			{
				id: "17000000-0000-4000-8000-000000000002",
				walletId: walletIds.mamaNgo,
				amountFcfa: 5400,
				reason: "Order payout",
				reference: "RST-DEMO-0001",
			},
			{
				id: "17000000-0000-4000-8000-000000000003",
				walletId: walletIds.paul,
				amountFcfa: 1200,
				reason: "Delivery payout",
				reference: "RST-DEMO-0001",
			},
		],
	});
}

// Creates the platform settings the admin settings screen edits.
async function seedSettings() {
	await prisma.platformSetting.createMany({
		skipDuplicates: true,
		data: [
			{ key: "delivery_fee_fcfa", value: "1000" },
			{ key: "default_commission_percent", value: "10" },
			{ key: "min_order_fcfa", value: "1000" },
			{ key: "support_phone", value: "+237677000000" },
			{ key: "platform_name", value: "Resto" },
		],
	});
}

// Runs every seed step in order.
async function main() {
	console.log("Seeding the database...");

	await seedAdmins();
	await seedPeople();
	await seedApplications();
	await seedCatalog();
	await seedOrders();
	await seedWallets();
	await seedSettings();

	console.log("Seed finished.");
	console.log(`Super admin: ${process.env.ADMIN_EMAIL ?? "admin@resto.local"} / ${ADMIN_PASSWORD}`);
	console.log(`Demo users:  alice@example.com / ${DEMO_PASSWORD}`);
}

main()
	.catch((error) => {
		console.error("Seed failed:", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
