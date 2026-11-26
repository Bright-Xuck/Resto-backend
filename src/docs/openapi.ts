// OpenAPI description for the auth and admin APIs, served by Swagger UI at /docs.
// The response shapes below match the controllers, services and repositories in src/.
export const openapi = {
	openapi: "3.0.3",
	info: {
		title: "Resto Backend API",
		version: "1.0.0",
		description: [
			"REST API for the Resto multi-restaurant app in Cameroon.",
			"",
			"### Authentication",
			"- Send the short-lived access token on every protected call: `Authorization: Bearer <accessToken>` (15 minutes).",
			"- Login, registration and the admin MFA endpoints also set an HttpOnly `refreshToken` cookie. The browser must send it with `credentials: \"include\"` (fetch) or `withCredentials: true` (axios). The refresh token is never returned in a JSON body.",
			"- `POST /api/auth/refresh` rotates the cookie and returns a new access token. `POST /api/auth/logout` revokes it and clears the cookie.",
			"- Refresh lifetime is 30 days for customers, merchants and riders, and 8 hours for admins.",
			"",
			"### Admin two-factor flow",
			"- An admin login never returns a session. It returns `{ mfaRequired: true, mfaSetupRequired, mfaToken }`.",
			"- If `mfaSetupRequired` is true, call `POST /api/auth/admin/mfa/setup` with the `mfaToken`, add the returned secret to an authenticator app, then call `POST /api/auth/admin/mfa/enable` with a code. That response contains the session, access token and eight one-time recovery codes.",
			"- Otherwise call `POST /api/auth/admin/mfa/verify` with a TOTP code or a recovery code.",
			"- Refunds, wallet adjustments and permanent bans need a stepped-up token from `POST /api/auth/admin/step-up`. The step-up is valid for 5 minutes.",
			"",
			"### Idempotency",
			"- Application decisions, moderation actions, refunds, reassignments and wallet adjustments require an `Idempotency-Key` header.",
			"- Repeating the same key with the same body replays the first 2xx response for 24 hours. Reusing a key with a different body returns 409.",
			"",
			"### Conventions",
			"- Money is an integer number of FCFA.",
			"- Errors are always `{ \"message\": \"...\" }` with an explicit status code.",
			"- Rate-limited routes return 429 when the limit is reached.",
		].join("\n"),
	},
	servers: [{ url: "http://localhost:5000" }],
	tags: [
		{ name: "Auth", description: "Registration, login, sessions and admin MFA" },
		{ name: "Admin", description: "Administration endpoints; every route needs an admin access token" },
	],
	// Every operation is protected unless it overrides this with security: [].
	security: [{ bearerAuth: [] }],
	components: {
		parameters: {
			Page: {
				name: "page",
				in: "query",
				schema: { type: "integer", minimum: 1, default: 1 },
				description: "One-based page number.",
			},
			Limit: {
				name: "limit",
				in: "query",
				schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
				description: "Rows per page (maximum 100).",
			},
			Id: {
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string", format: "uuid" },
				description: "Resource UUID.",
			},
			ApplicationType: {
				name: "type",
				in: "path",
				required: true,
				schema: { type: "string", enum: ["merchant", "rider"] },
				description: "Which application queue the id belongs to.",
			},
			IdempotencyKey: {
				name: "Idempotency-Key",
				in: "header",
				required: true,
				schema: { type: "string", maxLength: 200 },
				description:
					"A unique value per action (a UUID is a good choice). A retry with the same key and body replays the first 2xx response for 24 hours. The same key with a different body returns 409.",
			},
			DeviceId: {
				name: "X-Device-Id",
				in: "header",
				required: false,
				schema: { type: "string", maxLength: 200 },
				description:
					"Optional client-generated device identifier. It is stored on the refresh token so sessions can be told apart.",
			},
		},
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
				description:
					"Access token from login, register, refresh, MFA verify/enable or step-up. Send it as `Authorization: Bearer <token>`.",
			},
			refreshCookie: {
				type: "apiKey",
				in: "cookie",
				name: "refreshToken",
				description:
					"HttpOnly, SameSite=Lax cookie set by login and registration. Send requests with credentials so the browser includes it.",
			},
		},
		responses: {
			BadRequest: {
				description: "Validation failed or the request cannot be applied.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
			Unauthorized: {
				description: "The access token is missing, invalid or expired, or the refresh cookie is missing.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
			Forbidden: {
				description: "The signed-in account may not use this route.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
			NotFound: {
				description: "The requested record does not exist.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
			Conflict: {
				description: "The request conflicts with the current state.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
			TooManyRequests: {
				description: "Rate limit or resend cooldown reached. Try again later.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
			ServerError: {
				description: "Unexpected server error.",
				content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
			},
		},
		schemas: {
			ErrorResponse: {
				type: "object",
				required: ["message"],
				properties: { message: { type: "string", example: "That account does not exist." } },
			},
			MessageResponse: {
				type: "object",
				required: ["message"],
				properties: { message: { type: "string" } },
			},
			User: {
				type: "object",
				description: "Public account shape. The password hash is never returned.",
				required: ["id", "type", "status", "fullName", "locale", "createdAt", "updatedAt"],
				properties: {
					id: { type: "string", format: "uuid" },
					type: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
					status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"] },
					adminRole: {
						type: "string",
						nullable: true,
						enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
					},
					email: { type: "string", format: "email", nullable: true },
					emailVerifiedAt: { type: "string", format: "date-time", nullable: true },
					phone: { type: "string", nullable: true, example: "+237671234567" },
					phoneVerifiedAt: { type: "string", format: "date-time", nullable: true },
					failedAttempts: { type: "integer" },
					lockedUntil: { type: "string", format: "date-time", nullable: true },
					fullName: { type: "string", example: "Aïcha Mbah" },
					locale: { type: "string", enum: ["en", "fr"] },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
					deletedAt: { type: "string", format: "date-time", nullable: true },
				},
			},
			AdminPublicUser: {
				type: "object",
				description: "Account shape used by admin user and admin staff endpoints.",
				required: ["id", "type", "status", "fullName", "locale", "createdAt", "updatedAt"],
				properties: {
					id: { type: "string", format: "uuid" },
					type: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
					status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"] },
					adminRole: {
						type: "string",
						nullable: true,
						enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
					},
					email: { type: "string", format: "email", nullable: true },
					phone: { type: "string", nullable: true },
					fullName: { type: "string" },
					locale: { type: "string", enum: ["en", "fr"] },
					emailVerifiedAt: { type: "string", format: "date-time", nullable: true },
					phoneVerifiedAt: { type: "string", format: "date-time", nullable: true },
					lockedUntil: { type: "string", format: "date-time", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			AdminUserDetail: {
				allOf: [
					{ $ref: "#/components/schemas/AdminPublicUser" },
					{
						type: "object",
						properties: {
							failedAttempts: { type: "integer" },
							wallet: {
								type: "object",
								nullable: true,
								properties: {
									id: { type: "string", format: "uuid" },
									balanceFcfa: { type: "integer" },
								},
							},
							_count: {
								type: "object",
								properties: {
									customerOrders: { type: "integer" },
									riderOrders: { type: "integer" },
									restaurants: { type: "integer" },
								},
							},
						},
					},
				],
			},
			AdminListItem: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					email: { type: "string", format: "email", nullable: true },
					fullName: { type: "string" },
					adminRole: {
						type: "string",
						nullable: true,
						enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
					},
					status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"] },
					createdAt: { type: "string", format: "date-time" },
					adminMfa: {
						type: "object",
						nullable: true,
						properties: { enabledAt: { type: "string", format: "date-time", nullable: true } },
					},
				},
			},
			SessionResponse: {
				type: "object",
				required: ["user", "accessToken"],
				properties: {
					user: { $ref: "#/components/schemas/User" },
					accessToken: { type: "string", description: "JWT valid for 15 minutes." },
				},
			},
			MfaChallenge: {
				type: "object",
				required: ["mfaRequired", "mfaSetupRequired", "mfaToken"],
				properties: {
					mfaRequired: { type: "boolean", example: true },
					mfaSetupRequired: {
						type: "boolean",
						description: "True when the admin must call /admin/mfa/setup and /admin/mfa/enable first.",
					},
					mfaToken: {
						type: "string",
						description: "Five-minute token accepted only by the admin MFA endpoints.",
					},
				},
			},
			MfaEnableResponse: {
				allOf: [
					{ $ref: "#/components/schemas/SessionResponse" },
					{
						type: "object",
						required: ["recoveryCodes"],
						properties: {
							recoveryCodes: {
								type: "array",
								description: "Eight one-time codes. Show them once; only hashes are stored.",
								items: { type: "string", example: "A1B2C-3D4E5" },
							},
						},
					},
				],
			},
			AccessTokenResponse: {
				type: "object",
				required: ["accessToken"],
				properties: { accessToken: { type: "string" } },
			},
			RegisterBody: {
				type: "object",
				required: ["fullName", "email", "password", "type", "acceptedTerms"],
				properties: {
					fullName: { type: "string", example: "Jean-Paul Nkeng" },
					email: { type: "string", format: "email", example: "jean@example.com" },
					password: { type: "string", minLength: 8, example: "Password123!" },
					type: { type: "string", enum: ["CUSTOMER", "MERCHANT"] },
					locale: { type: "string", enum: ["en", "fr"], default: "en" },
					acceptedTerms: { type: "boolean", example: true },
				},
			},
			RiderRegisterBody: {
				type: "object",
				required: ["fullName", "phone", "code", "password", "acceptedTerms"],
				properties: {
					fullName: { type: "string", example: "Aïcha Mbah" },
					phone: { type: "string", pattern: "^\\+2376\\d{8}$", example: "+237671234567" },
					code: { type: "string", pattern: "^\\d{6}$", example: "123456" },
					password: { type: "string", minLength: 8, example: "Password123!" },
					email: { type: "string", format: "email", example: "aicha@example.com" },
					locale: { type: "string", enum: ["en", "fr"], default: "en" },
					acceptedTerms: { type: "boolean", example: true },
				},
			},
			LoginBody: {
				type: "object",
				required: ["password"],
				description: "Send either email or phone, plus the password.",
				properties: {
					email: { type: "string", format: "email", example: "jean@example.com" },
					phone: { type: "string", pattern: "^\\+2376\\d{8}$", example: "+237671234567" },
					password: { type: "string", example: "Password123!" },
				},
			},
			OtpRequestBody: {
				type: "object",
				required: ["phone"],
				properties: {
					phone: { type: "string", pattern: "^\\+2376\\d{8}$", example: "+237671234567" },
				},
			},
			ForgotPasswordBody: {
				type: "object",
				required: ["email"],
				properties: { email: { type: "string", format: "email" } },
			},
			ResetPasswordBody: {
				type: "object",
				required: ["token", "newPassword"],
				properties: {
					token: { type: "string", minLength: 20 },
					newPassword: { type: "string", minLength: 8 },
				},
			},
			PhoneChangeVerifyBody: {
				type: "object",
				required: ["phone", "code"],
				properties: {
					phone: { type: "string", pattern: "^\\+2376\\d{8}$", example: "+237671234567" },
					code: { type: "string", pattern: "^\\d{6}$", example: "123456" },
				},
			},
			MfaTokenBody: {
				type: "object",
				required: ["mfaToken"],
				properties: { mfaToken: { type: "string", minLength: 20 } },
			},
			MfaCodeBody: {
				type: "object",
				required: ["mfaToken", "code"],
				properties: {
					mfaToken: { type: "string", minLength: 20 },
					code: { type: "string", minLength: 6, maxLength: 12, example: "123456" },
				},
			},
			MfaDisableBody: {
				type: "object",
				required: ["password", "code"],
				properties: {
					password: { type: "string" },
					code: { type: "string", minLength: 6, maxLength: 12, example: "123456" },
				},
			},
			StepUpBody: {
				type: "object",
				required: ["code"],
				properties: { code: { type: "string", minLength: 6, maxLength: 12, example: "123456" } },
			},
			StatusBody: {
				type: "object",
				required: ["status", "reason"],
				properties: {
					status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED"] },
					reason: { type: "string", minLength: 3, maxLength: 500, example: "Repeated policy violations" },
				},
			},
			DecisionBody: {
				type: "object",
				required: ["decision", "note"],
				properties: {
					decision: { type: "string", enum: ["APPROVE", "REJECT"] },
					note: { type: "string", minLength: 3, maxLength: 1000, example: "Documents checked and valid" },
				},
			},
			ModerationActionBody: {
				type: "object",
				required: ["action", "note"],
				properties: {
					action: { type: "string", enum: ["FLAG", "HIDE", "RESTORE", "REMOVE"] },
					note: { type: "string", minLength: 3, maxLength: 500 },
				},
			},
			RefundBody: {
				type: "object",
				required: ["amountFcfa", "reason"],
				properties: {
					amountFcfa: { type: "integer", minimum: 1, maximum: 100000000, example: 2500 },
					reason: { type: "string", minLength: 3, maxLength: 500, example: "Order arrived cold" },
				},
			},
			ReassignBody: {
				type: "object",
				required: ["riderId", "reason"],
				properties: {
					riderId: { type: "string", format: "uuid" },
					reason: { type: "string", minLength: 3, maxLength: 500, example: "Original rider had a breakdown" },
				},
			},
			WalletAdjustBody: {
				type: "object",
				required: ["amountFcfa", "reason"],
				properties: {
					amountFcfa: {
						type: "integer",
						example: 1000,
						description:
							"Positive adds money, negative removes it. Cannot be zero or larger than 100000000 in magnitude, and the balance cannot go below zero.",
					},
					reason: { type: "string", minLength: 3, maxLength: 500 },
				},
			},
			MenuItemUpdateBody: {
				type: "object",
				description: "Send at least one field.",
				properties: {
					name: { type: "string", minLength: 2, maxLength: 120 },
					priceFcfa: { type: "integer", minimum: 0, maximum: 100000000 },
					isAvailable: { type: "boolean" },
				},
			},
			RestaurantStatusBody: {
				type: "object",
				required: ["status", "note"],
				properties: {
					status: { type: "string", enum: ["APPROVED", "SUSPENDED"] },
					note: { type: "string", minLength: 3, maxLength: 500 },
				},
			},
			SettingsBody: {
				type: "object",
				required: ["settings"],
				properties: {
					settings: {
						type: "array",
						minItems: 1,
						maxItems: 30,
						items: {
							type: "object",
							required: ["key", "value"],
							properties: {
								key: {
									type: "string",
									enum: [
										"platform_name",
										"support_phone",
										"categories",
										"delivery_fee_fcfa",
										"min_order_fcfa",
										"default_commission_percent",
										"delivery_radius_km",
									],
								},
								value: { type: "string", minLength: 1, maxLength: 500, example: "1500" },
							},
						},
					},
				},
			},
			AdminRoleBody: {
				type: "object",
				required: ["adminRole"],
				properties: {
					adminRole: {
						type: "string",
						enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
					},
				},
			},
			CreateAdminBody: {
				type: "object",
				required: ["email", "fullName", "password", "adminRole"],
				properties: {
					email: { type: "string", format: "email" },
					fullName: { type: "string", example: "Ngono Marie" },
					password: { type: "string", minLength: 8 },
					adminRole: {
						type: "string",
						enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
					},
				},
			},
			UserPage: {
				type: "object",
				required: ["users", "total", "page", "limit", "totalPages"],
				properties: {
					users: { type: "array", items: { $ref: "#/components/schemas/AdminPublicUser" } },
					total: { type: "integer" },
					page: { type: "integer" },
					limit: { type: "integer" },
					totalPages: { type: "integer" },
				},
			},
			AdminPage: {
				type: "object",
				required: ["admins", "total", "page", "limit", "totalPages"],
				properties: {
					admins: { type: "array", items: { $ref: "#/components/schemas/AdminListItem" } },
					total: { type: "integer" },
					page: { type: "integer" },
					limit: { type: "integer" },
					totalPages: { type: "integer" },
				},
			},
			AuditLog: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					userId: { type: "string", format: "uuid", nullable: true },
					action: { type: "string", example: "USER_STATUS_CHANGED" },
					targetType: { type: "string", nullable: true, example: "User" },
					targetId: { type: "string", nullable: true },
					details: { type: "string", nullable: true },
					ip: { type: "string", nullable: true },
					userAgent: { type: "string", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					user: {
						type: "object",
						nullable: true,
						properties: {
							id: { type: "string", format: "uuid" },
							fullName: { type: "string" },
							email: { type: "string", format: "email", nullable: true },
							type: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
							adminRole: {
								type: "string",
								nullable: true,
								enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
							},
						},
					},
				},
			},
			AuditPage: {
				type: "object",
				required: ["logs", "total", "page", "limit", "totalPages"],
				properties: {
					logs: { type: "array", items: { $ref: "#/components/schemas/AuditLog" } },
					total: { type: "integer" },
					page: { type: "integer" },
					limit: { type: "integer" },
					totalPages: { type: "integer" },
				},
			},
			Applicant: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					fullName: { type: "string" },
					email: { type: "string", format: "email", nullable: true },
					phone: { type: "string", nullable: true },
					status: {
						type: "string",
						enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"],
						description: "Included on the detail endpoint.",
					},
				},
			},
			MerchantApplicationRecord: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					userId: { type: "string", format: "uuid" },
					restaurantName: { type: "string" },
					category: { type: "string" },
					phone: { type: "string" },
					address: { type: "string" },
					businessPermitUrl: { type: "string", nullable: true },
					taxIdUrl: { type: "string", nullable: true },
					status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
					decisionNote: { type: "string", nullable: true },
					reviewedById: { type: "string", format: "uuid", nullable: true },
					reviewedAt: { type: "string", format: "date-time", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			MerchantApplication: {
				allOf: [
					{ $ref: "#/components/schemas/MerchantApplicationRecord" },
					{ type: "object", properties: { user: { $ref: "#/components/schemas/Applicant" } } },
				],
			},
			RiderApplicationRecord: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					userId: { type: "string", format: "uuid" },
					vehicleType: { type: "string", enum: ["MOTORCYCLE", "BICYCLE", "CAR"] },
					nationalIdUrl: { type: "string", nullable: true },
					licenceUrl: { type: "string", nullable: true },
					bikeRegistrationUrl: { type: "string", nullable: true },
					status: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
					decisionNote: { type: "string", nullable: true },
					reviewedById: { type: "string", format: "uuid", nullable: true },
					reviewedAt: { type: "string", format: "date-time", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			RiderApplication: {
				allOf: [
					{ $ref: "#/components/schemas/RiderApplicationRecord" },
					{ type: "object", properties: { user: { $ref: "#/components/schemas/Applicant" } } },
				],
			},
			ApplicationPage: {
				type: "object",
				required: ["type", "applications", "total", "page", "limit", "totalPages"],
				properties: {
					type: { type: "string", enum: ["merchant", "rider"] },
					applications: {
						type: "array",
						items: {
							oneOf: [
								{ $ref: "#/components/schemas/MerchantApplication" },
								{ $ref: "#/components/schemas/RiderApplication" },
							],
						},
					},
					total: { type: "integer" },
					page: { type: "integer" },
					limit: { type: "integer" },
					totalPages: { type: "integer" },
				},
			},
			ModerationMenuItem: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string" },
					priceFcfa: { type: "integer" },
					isAvailable: { type: "boolean" },
					moderationStatus: { type: "string", enum: ["VISIBLE", "FLAGGED", "HIDDEN"] },
					moderationNote: { type: "string", nullable: true },
					restaurant: {
						type: "object",
						properties: {
							id: { type: "string", format: "uuid" },
							name: { type: "string" },
						},
					},
				},
			},
			ModerationRestaurant: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					name: { type: "string" },
					status: { type: "string", enum: ["PENDING", "APPROVED", "SUSPENDED"] },
					isOpen: { type: "boolean" },
				},
			},
			ModerationReport: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					targetType: { type: "string", enum: ["MENU_ITEM", "RESTAURANT"] },
					targetId: { type: "string", format: "uuid" },
					reason: { type: "string" },
					status: { type: "string", enum: ["OPEN", "RESOLVED"] },
					resolutionNote: { type: "string", nullable: true },
					resolvedById: { type: "string", format: "uuid", nullable: true },
					resolvedAt: { type: "string", format: "date-time", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					target: {
						type: "object",
						nullable: true,
						description: "The reported item or restaurant. Null if it was deleted.",
						oneOf: [
							{ $ref: "#/components/schemas/ModerationMenuItem" },
							{ $ref: "#/components/schemas/ModerationRestaurant" },
						],
					},
				},
			},
			ModerationPage: {
				type: "object",
				required: ["reports", "total", "page", "limit", "totalPages"],
				properties: {
					reports: { type: "array", items: { $ref: "#/components/schemas/ModerationReport" } },
					total: { type: "integer" },
					page: { type: "integer" },
					limit: { type: "integer" },
					totalPages: { type: "integer" },
				},
			},
			Restaurant: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					ownerId: { type: "string", format: "uuid" },
					name: { type: "string" },
					category: { type: "string" },
					phone: { type: "string" },
					address: { type: "string" },
					status: { type: "string", enum: ["PENDING", "APPROVED", "SUSPENDED"] },
					isOpen: { type: "boolean" },
					commissionPercent: { type: "integer", example: 10 },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			RestaurantSummary: {
				allOf: [
					{ $ref: "#/components/schemas/Restaurant" },
					{
						type: "object",
						properties: {
							owner: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									fullName: { type: "string" },
									email: { type: "string", format: "email", nullable: true },
									phone: { type: "string", nullable: true },
								},
							},
							_count: {
								type: "object",
								properties: {
									menuItems: { type: "integer" },
									orders: { type: "integer" },
								},
							},
						},
					},
				],
			},
			RestaurantPage: {
				type: "object",
				required: ["restaurants", "total", "page", "limit", "totalPages"],
				properties: {
					restaurants: { type: "array", items: { $ref: "#/components/schemas/RestaurantSummary" } },
					total: { type: "integer" },
					page: { type: "integer" },
					limit: { type: "integer" },
					totalPages: { type: "integer" },
				},
			},
			MenuItem: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					restaurantId: { type: "string", format: "uuid" },
					name: { type: "string" },
					priceFcfa: { type: "integer" },
					isAvailable: { type: "boolean" },
					moderationStatus: { type: "string", enum: ["VISIBLE", "FLAGGED", "HIDDEN"] },
					moderationNote: { type: "string", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			MenuItemWithRestaurant: {
				allOf: [
					{ $ref: "#/components/schemas/MenuItem" },
					{
						type: "object",
						properties: {
							restaurant: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									name: { type: "string" },
								},
							},
						},
					},
				],
			},
			RestaurantDetail: {
				allOf: [
					{ $ref: "#/components/schemas/Restaurant" },
					{
						type: "object",
						properties: {
							owner: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									fullName: { type: "string" },
									email: { type: "string", format: "email", nullable: true },
									phone: { type: "string", nullable: true },
									status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"] },
								},
							},
							menuItems: { type: "array", items: { $ref: "#/components/schemas/MenuItem" } },
						},
					},
				],
			},
			Order: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					reference: { type: "string" },
					customerId: { type: "string", format: "uuid" },
					restaurantId: { type: "string", format: "uuid" },
					riderId: { type: "string", format: "uuid", nullable: true },
					status: {
						type: "string",
						enum: [
							"PLACED",
							"ACCEPTED",
							"PREPARING",
							"READY_FOR_PICKUP",
							"OUT_FOR_DELIVERY",
							"COMPLETED",
							"DELIVERY_FAILED",
							"CANCELLED",
							"REJECTED",
						],
					},
					totalFcfa: { type: "integer" },
					paymentMethod: { type: "string", enum: ["ONLINE", "COD"] },
					version: { type: "integer" },
					placedAt: { type: "string", format: "date-time" },
					completedAt: { type: "string", format: "date-time", nullable: true },
					cancelledAt: { type: "string", format: "date-time", nullable: true },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			OrderEvent: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					orderId: { type: "string", format: "uuid" },
					version: { type: "integer" },
					status: { type: "string", enum: ["PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "DELIVERY_FAILED", "CANCELLED", "REJECTED"] },
					note: { type: "string", nullable: true },
					createdById: { type: "string", format: "uuid", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					createdBy: {
						type: "object",
						nullable: true,
						properties: {
							id: { type: "string", format: "uuid" },
							fullName: { type: "string" },
							type: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
						},
					},
				},
			},
			Refund: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					paymentId: { type: "string", format: "uuid" },
					orderId: { type: "string", format: "uuid" },
					amountFcfa: { type: "integer" },
					reason: { type: "string" },
					adminId: { type: "string", format: "uuid" },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			RefundWithAdmin: {
				allOf: [
					{ $ref: "#/components/schemas/Refund" },
					{
						type: "object",
						properties: {
							admin: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									fullName: { type: "string" },
								},
							},
						},
					},
				],
			},
			Payment: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					orderId: { type: "string", format: "uuid" },
					state: { type: "string", enum: ["PENDING", "SUCCEEDED", "FAILED", "UNKNOWN", "REFUNDED"] },
					amountFcfa: { type: "integer" },
					provider: { type: "string", nullable: true },
					providerRef: { type: "string", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			PaymentWithRefunds: {
				allOf: [
					{ $ref: "#/components/schemas/Payment" },
					{
						type: "object",
						properties: {
							refunds: { type: "array", items: { $ref: "#/components/schemas/RefundWithAdmin" } },
						},
					},
				],
			},
			UnknownPayment: {
				allOf: [
					{ $ref: "#/components/schemas/Payment" },
					{
						type: "object",
						properties: {
							order: {
								type: "object",
								properties: {
									reference: { type: "string" },
									totalFcfa: { type: "integer" },
									status: { type: "string", enum: ["PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "COMPLETED", "DELIVERY_FAILED", "CANCELLED", "REJECTED"] },
								},
							},
						},
					},
				],
			},
			OrderTimeline: {
				allOf: [
					{ $ref: "#/components/schemas/Order" },
					{
						type: "object",
						properties: {
							customer: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									fullName: { type: "string" },
									email: { type: "string", format: "email", nullable: true },
									phone: { type: "string", nullable: true },
								},
							},
							restaurant: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									name: { type: "string" },
									phone: { type: "string" },
									address: { type: "string" },
								},
							},
							rider: {
								type: "object",
								nullable: true,
								properties: {
									id: { type: "string", format: "uuid" },
									fullName: { type: "string" },
									phone: { type: "string", nullable: true },
									riderProfile: {
										type: "object",
										nullable: true,
										properties: {
											vehicleType: { type: "string", enum: ["MOTORCYCLE", "BICYCLE", "CAR"] },
											verificationStatus: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
											lastLat: { type: "number", nullable: true },
											lastLng: { type: "number", nullable: true },
											lastSeenAt: { type: "string", format: "date-time", nullable: true },
										},
									},
								},
							},
							events: { type: "array", items: { $ref: "#/components/schemas/OrderEvent" } },
							payment: {
								nullable: true,
								allOf: [{ $ref: "#/components/schemas/PaymentWithRefunds" }],
							},
						},
					},
				],
			},
			Wallet: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					userId: { type: "string", format: "uuid" },
					balanceFcfa: { type: "integer" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			WalletLedgerEntry: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					walletId: { type: "string", format: "uuid" },
					amountFcfa: { type: "integer" },
					reason: { type: "string" },
					reference: { type: "string", nullable: true },
					createdById: { type: "string", format: "uuid", nullable: true },
					createdAt: { type: "string", format: "date-time" },
					createdBy: {
						type: "object",
						nullable: true,
						properties: {
							id: { type: "string", format: "uuid" },
							fullName: { type: "string" },
						},
					},
				},
			},
			WalletDetail: {
				allOf: [
					{ $ref: "#/components/schemas/Wallet" },
					{
						type: "object",
						properties: {
							user: {
								type: "object",
								properties: {
									id: { type: "string", format: "uuid" },
									fullName: { type: "string" },
									email: { type: "string", format: "email", nullable: true },
									phone: { type: "string", nullable: true },
									type: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
								},
							},
							entries: { type: "array", items: { $ref: "#/components/schemas/WalletLedgerEntry" } },
						},
					},
				],
			},
			Analytics: {
				type: "object",
				properties: {
					range: {
						type: "object",
						properties: {
							from: { type: "string", format: "date-time" },
							to: { type: "string", format: "date-time" },
						},
					},
					activeOrders: { type: "integer" },
					dailyActiveUsers: { type: "integer" },
					gmvFcfa: { type: "integer" },
					commissionEarnedFcfa: { type: "integer" },
					averageDeliveryMinutes: { type: "number" },
					ordersByStatus: {
						type: "object",
						additionalProperties: { type: "integer" },
						example: { PLACED: 3, COMPLETED: 12 },
					},
					daily: {
						type: "array",
						items: {
							type: "object",
							properties: {
								date: { type: "string", example: "2026-11-26" },
								orders: { type: "integer" },
								gmvFcfa: { type: "integer" },
								activeUsers: { type: "integer" },
							},
						},
					},
				},
			},
			Reconciliation: {
				type: "object",
				properties: {
					paymentsByState: {
						type: "object",
						additionalProperties: {
							type: "object",
							properties: {
								count: { type: "integer" },
								amountFcfa: { type: "integer" },
							},
						},
					},
					refunds: {
						type: "object",
						properties: {
							count: { type: "integer" },
							amountFcfa: { type: "integer" },
						},
					},
					completedOrdersFcfa: { type: "integer" },
					platformCommissionFcfa: { type: "integer" },
					merchantPayableFcfa: { type: "integer" },
					deliveryPayoutsFcfa: { type: "integer" },
					unknownPayments: { type: "array", items: { $ref: "#/components/schemas/UnknownPayment" } },
				},
			},
			PlatformSetting: {
				type: "object",
				properties: {
					key: { type: "string" },
					value: { type: "string" },
					updatedById: { type: "string", format: "uuid", nullable: true },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			SettingsResponse: {
				type: "object",
				required: ["settings"],
				properties: {
					settings: { type: "array", items: { $ref: "#/components/schemas/PlatformSetting" } },
				},
			},
			UpdateSettingsResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					settings: { type: "array", items: { $ref: "#/components/schemas/PlatformSetting" } },
				},
			},
			MeResponse: {
				type: "object",
				required: ["user"],
				properties: { user: { $ref: "#/components/schemas/User" } },
			},
			MfaSetupResponse: {
				type: "object",
				required: ["secret", "otpauthUri", "message"],
				properties: {
					secret: { type: "string", description: "Base32 TOTP secret." },
					otpauthUri: { type: "string", description: "otpauth:// URI for the authenticator app." },
					message: { type: "string" },
				},
			},
			UserDetailResponse: {
				type: "object",
				required: ["user"],
				properties: { user: { $ref: "#/components/schemas/AdminUserDetail" } },
			},
			ApplicationDetailResponse: {
				type: "object",
				required: ["application"],
				properties: {
					application: {
						oneOf: [
							{ $ref: "#/components/schemas/MerchantApplication" },
							{ $ref: "#/components/schemas/RiderApplication" },
						],
					},
				},
			},
			RestaurantDetailResponse: {
				type: "object",
				required: ["restaurant"],
				properties: { restaurant: { $ref: "#/components/schemas/RestaurantDetail" } },
			},
			OrderTimelineResponse: {
				type: "object",
				required: ["order"],
				properties: { order: { $ref: "#/components/schemas/OrderTimeline" } },
			},
			WalletDetailResponse: {
				type: "object",
				required: ["wallet"],
				properties: { wallet: { $ref: "#/components/schemas/WalletDetail" } },
			},
			AdminUserStatusResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					user: { $ref: "#/components/schemas/AdminPublicUser" },
				},
			},
			CredentialResetResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					temporaryPassword: { type: "string", description: "Shown once; share it securely." },
				},
			},
			CreateAdminResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					user: { $ref: "#/components/schemas/AdminPublicUser" },
				},
			},
			AdminRoleResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					user: { $ref: "#/components/schemas/AdminPublicUser" },
				},
			},
			DecisionResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					application: {
						oneOf: [
							{ $ref: "#/components/schemas/MerchantApplicationRecord" },
							{ $ref: "#/components/schemas/RiderApplicationRecord" },
						],
					},
				},
			},
			ModerationActionResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					report: { $ref: "#/components/schemas/ModerationReport" },
				},
			},
			RestaurantStatusResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					restaurant: { $ref: "#/components/schemas/Restaurant" },
				},
			},
			MenuItemUpdateResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					menuItem: { $ref: "#/components/schemas/MenuItemWithRestaurant" },
				},
			},
			RefundResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					refund: { $ref: "#/components/schemas/Refund" },
				},
			},
			ReassignResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					order: { $ref: "#/components/schemas/Order" },
				},
			},
			WalletAdjustResponse: {
				type: "object",
				properties: {
					message: { type: "string" },
					wallet: { $ref: "#/components/schemas/Wallet" },
				},
			},
		},
	},
	paths: {
		"/health": {
			get: {
				operationId: "health",
				summary: "Health check",
				security: [],
				responses: {
					"200": {
						description: "Server is running",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										ok: { type: "string", example: "ok" },
										message: { type: "string", example: "The server is running" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/api/auth/register": {
			post: {
				tags: ["Auth"],
				operationId: "register",
				summary: "Create a customer or merchant account",
				security: [],
				parameters: [{ $ref: "#/components/parameters/DeviceId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RegisterBody" },
						},
					},
				},
				responses: {
					"201": {
						description: "Account created and session started",
						headers: {
							"Set-Cookie": {
								description: "Sets the HttpOnly refreshToken cookie.",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"409": {
						description: "This email is already registered.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/otp/request": {
			post: {
				tags: ["Auth"],
				operationId: "requestRiderOtp",
				summary: "Send a rider signup code",
				description: "Creates a six-digit code for a Cameroon phone number. There is no SMS provider yet, so the code is printed in the server log as `[otp] <phone>: <code>`.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/OtpRequestBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Code created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"409": {
						description: "This phone number is already registered.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": {
						description: "Resend cooldown (60 seconds) or rate limit reached.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/register/rider": {
			post: {
				tags: ["Auth"],
				operationId: "registerRider",
				summary: "Verify the code and create a rider account",
				security: [],
				parameters: [{ $ref: "#/components/parameters/DeviceId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RiderRegisterBody" },
						},
					},
				},
				responses: {
					"201": {
						description: "Rider created and session started",
						headers: {
							"Set-Cookie": {
								description: "Sets the HttpOnly refreshToken cookie.",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
							},
						},
					},
					"400": {
						description: "Invalid code, expired code or code already used.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"409": {
						description: "This phone number or email is already registered.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": {
						description: "Too many incorrect code attempts or rate limit reached.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/login": {
			post: {
				tags: ["Auth"],
				operationId: "login",
				summary: "Log in with email or phone",
				description: "Non-admin accounts receive `{ user, accessToken }` plus the refresh cookie. Admin accounts receive an MFA challenge instead and must complete `/api/auth/admin/mfa/verify` or `/api/auth/admin/mfa/enable`.",
				security: [],
				parameters: [{ $ref: "#/components/parameters/DeviceId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/LoginBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Session created, or an admin MFA challenge",
						headers: {
							"Set-Cookie": {
								description: "Set only when a session is created, not for the admin MFA challenge.",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: {
									oneOf: [
										{ $ref: "#/components/schemas/SessionResponse" },
										{ $ref: "#/components/schemas/MfaChallenge" },
									],
								},
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"401": {
						description: "The email/phone or password is incorrect.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": {
						description: "The account is not active, or the admin has no role assigned.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"423": {
						description: "The account is locked after too many failed attempts.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/refresh": {
			post: {
				tags: ["Auth"],
				operationId: "refreshSession",
				summary: "Rotate the refresh token and return a new access token",
				description: "Requires the HttpOnly refreshToken cookie. The old token is marked used and a new cookie is set. Reusing an old token revokes the whole token family.",
				security: [{ refreshCookie: [] }],
				responses: {
					"200": {
						description: "New access token; the refresh cookie is rotated",
						headers: {
							"Set-Cookie": {
								description: "Replaces the refreshToken cookie with the rotated token.",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AccessTokenResponse" },
							},
						},
					},
					"401": {
						description: "Refresh cookie missing, invalid, expired, revoked or already used.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": {
						description: "The account is no longer active.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/logout": {
			post: {
				tags: ["Auth"],
				operationId: "logout",
				summary: "Revoke the current refresh token",
				description: "Requires the HttpOnly refreshToken cookie. The cookie is cleared even if the token was already revoked.",
				security: [{ refreshCookie: [] }],
				responses: {
					"200": {
						description: "Logged out and cookie cleared",
						headers: {
							"Set-Cookie": {
								description: "Clears the refreshToken cookie.",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"401": {
						description: "The refresh cookie is missing.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/logout-all": {
			post: {
				tags: ["Auth"],
				operationId: "logoutAllDevices",
				summary: "Revoke every session for the signed-in user",
				responses: {
					"200": {
						description: "All refresh tokens revoked and cookie cleared",
						headers: {
							"Set-Cookie": {
								description: "Clears the refreshToken cookie.",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"401": { $ref: "#/components/responses/Unauthorized" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/forgot-password": {
			post: {
				tags: ["Auth"],
				operationId: "forgotPassword",
				summary: "Request a password reset link",
				description: "Always returns the same message so the endpoint does not reveal whether an email exists. There is no email provider yet, so the link is printed in the server log.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ForgotPasswordBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Reset link sent if the email exists",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/reset-password": {
			post: {
				tags: ["Auth"],
				operationId: "resetPassword",
				summary: "Set a new password with a reset token",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ResetPasswordBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Password updated and existing sessions revoked",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"400": {
						description: "Invalid, expired or already used reset token.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/phone/change/request": {
			post: {
				tags: ["Auth"],
				operationId: "requestPhoneChangeCode",
				summary: "Send a code before changing a rider phone number",
				description: "Riders only. The code is printed in the server log while there is no SMS provider.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/OtpRequestBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Code created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"401": { $ref: "#/components/responses/Unauthorized" },
					"403": {
						description: "This route is for riders only.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"409": {
						description: "This phone number is already registered.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": {
						description: "Resend cooldown (60 seconds) or rate limit reached.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/phone/change/verify": {
			post: {
				tags: ["Auth"],
				operationId: "verifyPhoneChangeCode",
				summary: "Verify the code and update the rider phone number",
				description: "Riders only.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/PhoneChangeVerifyBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Phone updated",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"400": {
						description: "Invalid, expired or already used code.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"401": { $ref: "#/components/responses/Unauthorized" },
					"403": {
						description: "This route is for riders only.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"409": {
						description: "This phone number is already registered.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": {
						description: "Too many incorrect attempts or rate limit reached.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/me": {
			get: {
				tags: ["Auth"],
				operationId: "getMe",
				summary: "Return the signed-in user",
				responses: {
					"200": {
						description: "Current user",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MeResponse" },
							},
						},
					},
					"401": { $ref: "#/components/responses/Unauthorized" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/admin/mfa/setup": {
			post: {
				tags: ["Auth"],
				operationId: "setupAdminMfa",
				summary: "Start admin two-factor enrolment",
				description: "Uses the short-lived mfaToken from an admin login. Returns a TOTP secret and otpauth URI. Call `/admin/mfa/enable` with the first code to finish.",
				security: [],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MfaTokenBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Secret and otpauth URI",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MfaSetupResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"401": {
						description: "Invalid or expired mfaToken.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"409": {
						description: "Two-factor authentication is already enabled.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/admin/mfa/enable": {
			post: {
				tags: ["Auth"],
				operationId: "enableAdminMfa",
				summary: "Confirm the first code and open the admin session",
				security: [],
				parameters: [{ $ref: "#/components/parameters/DeviceId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MfaCodeBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Session, access token and eight one-time recovery codes",
						headers: {
							"Set-Cookie": {
								description: "Sets the HttpOnly refreshToken cookie (8-hour admin lifetime).",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MfaEnableResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, setup was not started, or the stored secret could not be read.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"401": {
						description: "Invalid mfaToken or wrong authenticator code.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"409": {
						description: "Two-factor authentication is already enabled.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/admin/mfa/verify": {
			post: {
				tags: ["Auth"],
				operationId: "verifyAdminMfa",
				summary: "Complete an admin login with a TOTP or recovery code",
				security: [],
				parameters: [{ $ref: "#/components/parameters/DeviceId" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MfaCodeBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Session and access token",
						headers: {
							"Set-Cookie": {
								description: "Sets the HttpOnly refreshToken cookie (8-hour admin lifetime).",
								schema: { type: "string" },
							},
						},
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, MFA is not set up, or the stored secret could not be read.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"401": {
						description: "Invalid mfaToken or wrong authenticator/recovery code.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/admin/mfa/disable": {
			post: {
				tags: ["Auth"],
				operationId: "disableAdminMfa",
				summary: "Turn two-factor authentication off",
				description: "Admins only. Requires the current password and a valid authenticator code.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MfaDisableBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Two-factor authentication disabled",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed or two-factor authentication is not enabled.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"401": {
						description: "Wrong password or wrong authenticator code.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/auth/admin/step-up": {
			post: {
				tags: ["Auth"],
				operationId: "stepUpAdmin",
				summary: "Confirm a sensitive action and get a stepped-up access token",
				description: "Admins only. The returned token carries `stepUpAt` and is accepted by refunds, wallet adjustments and permanent bans for five minutes.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/StepUpBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "New access token with stepUpAt",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AccessTokenResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed or two-factor authentication is not set up.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"401": {
						description: "Wrong authenticator code.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/audit": {
			get: {
				tags: ["Admin"],
				operationId: "getAuditLogs",
				summary: "Read the append-only audit log",
				description: "Super admins only. Rows cannot be edited or deleted (database triggers enforce this).",
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "action", in: "query", schema: { type: "string" }, description: "Case-insensitive partial match." },
					{ name: "targetType", in: "query", schema: { type: "string" }, description: "Exact match, for example `User`." },
					{ name: "targetId", in: "query", schema: { type: "string" } },
					{ name: "actorId", in: "query", schema: { type: "string", format: "uuid" } },
					{ name: "from", in: "query", schema: { type: "string", format: "date-time" } },
					{ name: "to", in: "query", schema: { type: "string", format: "date-time" } },
				],
				responses: {
					"200": {
						description: "One page of audit rows, newest first",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AuditPage" },
							},
						},
					},
					"400": {
						description: "Invalid query values, or the from date is after the to date.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/users": {
			get: {
				tags: ["Admin"],
				operationId: "getUsers",
				summary: "Search accounts across every role",
				description: "Support and super admins.",
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "q", in: "query", schema: { type: "string" }, description: "Name, email or phone." },
					{
						name: "type",
						in: "query",
						schema: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
					},
					{
						name: "status",
						in: "query",
						schema: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"] },
					},
				],
				responses: {
					"200": {
						description: "One page of accounts, newest first",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/UserPage" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/users/{id}": {
			get: {
				tags: ["Admin"],
				operationId: "getUserById",
				summary: "Load one account with wallet and activity counts",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": {
						description: "The account",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/UserDetailResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/users/{id}/status": {
			patch: {
				tags: ["Admin"],
				operationId: "updateUserStatus",
				summary: "Suspend, ban or reactivate an account",
				description: "Support may suspend or reactivate. Only a super admin may ban, and a ban needs a stepped-up token. Suspending or banning revokes the account's sessions.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/StatusBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Status updated",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AdminUserStatusResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, you targeted your own account, or this is the last active super admin.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": {
						description: "Not allowed for this role, another admin was targeted, or the ban is missing step-up.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/users/{id}/credential-reset": {
			post: {
				tags: ["Admin"],
				operationId: "resetUserCredentials",
				summary: "Reset an account password and sign it out everywhere",
				description: "Returns a temporary password once. Only a super admin may reset another admin's password.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": {
						description: "Password reset and sessions revoked",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CredentialResetResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": {
						description: "Only a super admin may reset another admin's password.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/admins": {
			get: {
				tags: ["Admin"],
				operationId: "getAdmins",
				summary: "List admin accounts",
				description: "Super admins only. Includes whether MFA is enabled.",
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
				],
				responses: {
					"200": {
						description: "Admin accounts, oldest first",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AdminPage" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
			post: {
				tags: ["Admin"],
				operationId: "createAdminAccount",
				summary: "Create an admin account",
				description: "Super admins only. The new admin must set up MFA at first login.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateAdminBody" },
						},
					},
				},
				responses: {
					"201": {
						description: "Admin created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/CreateAdminResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"409": {
						description: "An account with this email already exists.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/admins/{id}/role": {
			patch: {
				tags: ["Admin"],
				operationId: "updateAdminRole",
				summary: "Change an admin sub-role",
				description: "Super admins only. Signs the admin out so old tokens cannot keep the old role.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/AdminRoleBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Role updated and sessions revoked",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/AdminRoleResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed or this would remove the last super admin.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/applications": {
			get: {
				tags: ["Admin"],
				operationId: "getApplications",
				summary: "List merchant or rider applications",
				description: "Admin verifiers and super admins.",
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{
						name: "type",
						in: "query",
						schema: { type: "string", enum: ["merchant", "rider"], default: "merchant" },
					},
					{
						name: "status",
						in: "query",
						schema: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED"] },
					},
				],
				responses: {
					"200": {
						description: "One page of applications, oldest first",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ApplicationPage" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/applications/{type}/{id}": {
			get: {
				tags: ["Admin"],
				operationId: "getApplicationById",
				summary: "Load one application with its documents",
				parameters: [
					{ $ref: "#/components/parameters/ApplicationType" },
					{ $ref: "#/components/parameters/Id" },
				],
				responses: {
					"200": {
						description: "The application and its applicant",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ApplicationDetailResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/applications/{type}/{id}/decision": {
			post: {
				tags: ["Admin"],
				operationId: "decideApplication",
				summary: "Approve or reject an application",
				description: "Requires an Idempotency-Key. Approval creates the restaurant (merchant) or verifies the rider profile (rider). Only a pending application can be decided.",
				parameters: [
					{ $ref: "#/components/parameters/ApplicationType" },
					{ $ref: "#/components/parameters/Id" },
					{ $ref: "#/components/parameters/IdempotencyKey" },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/DecisionBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Decision saved",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/DecisionResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, or the Idempotency-Key header is missing or too long.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"409": {
						description: "Already reviewed, still being processed, or the key was reused with a different body.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/moderation": {
			get: {
				tags: ["Admin"],
				operationId: "getModerationQueue",
				summary: "List reported content",
				description: "Support and super admins. Each report includes the reported menu item or restaurant, when it still exists.",
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "RESOLVED"] } },
				],
				responses: {
					"200": {
						description: "One page of reports, newest first",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ModerationPage" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/moderation/{id}/action": {
			post: {
				tags: ["Admin"],
				operationId: "moderateReport",
				summary: "Flag, hide, restore or remove reported content",
				description: "Requires an Idempotency-Key. Resolves the report and updates the reported content in one transaction. A restaurant can be hidden or restored but not flagged.",
				parameters: [
					{ $ref: "#/components/parameters/Id" },
					{ $ref: "#/components/parameters/IdempotencyKey" },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ModerationActionBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Report resolved",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ModerationActionResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, the Idempotency-Key is missing, or a restaurant was flagged.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"409": {
						description: "Report already resolved, its target was deleted, it is still processing, or the key was reused with a different body.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/restaurants": {
			get: {
				tags: ["Admin"],
				operationId: "getRestaurants",
				summary: "List restaurant listings",
				description: "Support and super admins.",
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "q", in: "query", schema: { type: "string" }, description: "Partial restaurant name." },
					{
						name: "status",
						in: "query",
						schema: { type: "string", enum: ["PENDING", "APPROVED", "SUSPENDED"] },
					},
				],
				responses: {
					"200": {
						description: "One page of restaurants, newest first",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RestaurantPage" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/restaurants/{id}": {
			get: {
				tags: ["Admin"],
				operationId: "getRestaurantById",
				summary: "Load one restaurant with its owner and menu",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": {
						description: "The restaurant and its menu items",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RestaurantDetailResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/menu-items/{id}": {
			patch: {
				tags: ["Admin"],
				operationId: "updateMenuItem",
				summary: "Edit a menu item",
				description: "Support and super admins. Correct the name, price or availability of a menu item. At least one field is required.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MenuItemUpdateBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Menu item updated",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MenuItemUpdateResponse" },
							},
						},
					},
					"400": {
						description: "No fields sent or invalid values.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/restaurants/{id}/status": {
			patch: {
				tags: ["Admin"],
				operationId: "updateRestaurantStatus",
				summary: "Suspend or restore a restaurant listing",
				description: "Suspending also closes the restaurant immediately.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RestaurantStatusBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Status updated",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RestaurantStatusResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/orders/{id}/timeline": {
			get: {
				tags: ["Admin"],
				operationId: "getOrderTimeline",
				summary: "Read an order's log, payment and rider location",
				description: "Support, finance and super admins.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": {
						description: "Order timeline",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/OrderTimelineResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/orders/{id}/refund": {
			post: {
				tags: ["Admin"],
				operationId: "refundOrder",
				summary: "Refund part or all of an online payment",
				description: "Finance and super admins. Requires a stepped-up token and an Idempotency-Key. The total refunded can never exceed the payment amount.",
				parameters: [
					{ $ref: "#/components/parameters/Id" },
					{ $ref: "#/components/parameters/IdempotencyKey" },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/RefundBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Refund recorded",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RefundResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, missing Idempotency-Key, no online payment, already fully refunded, or amount above the remaining balance.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": {
						description: "Wrong role or missing step-up.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"404": { $ref: "#/components/responses/NotFound" },
					"409": {
						description: "A concurrent refund changed the payment, it is still processing, or the key was reused with a different body.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/orders/{id}/reassign": {
			post: {
				tags: ["Admin"],
				operationId: "reassignOrder",
				summary: "Move an active order to another verified rider",
				description: "Finance and super admins. Requires an Idempotency-Key. The order must still be PLACED, ACCEPTED, PREPARING, READY_FOR_PICKUP or OUT_FOR_DELIVERY, and the rider must be active and verified.",
				parameters: [
					{ $ref: "#/components/parameters/Id" },
					{ $ref: "#/components/parameters/IdempotencyKey" },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ReassignBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Order reassigned",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/ReassignResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, missing Idempotency-Key, order closed, same rider already assigned, or rider inactive/unverified.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"409": {
						description: "The order changed at the same time, it is still processing, or the key was reused with a different body.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/wallets/{id}": {
			get: {
				tags: ["Admin"],
				operationId: "getWallet",
				summary: "Load a wallet and its latest ledger entries",
				description: "Finance and super admins. Returns the 50 newest ledger entries.",
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": {
						description: "The wallet",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/WalletDetailResponse" },
							},
						},
					},
					"400": { $ref: "#/components/responses/BadRequest" },
					"403": { $ref: "#/components/responses/Forbidden" },
					"404": { $ref: "#/components/responses/NotFound" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/wallets/{id}/adjust": {
			post: {
				tags: ["Admin"],
				operationId: "adjustWallet",
				summary: "Add or remove money from a wallet",
				description: "Finance and super admins. Requires a stepped-up token and an Idempotency-Key. The balance can never go below zero.",
				parameters: [
					{ $ref: "#/components/parameters/Id" },
					{ $ref: "#/components/parameters/IdempotencyKey" },
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/WalletAdjustBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Wallet adjusted and a ledger row written",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/WalletAdjustResponse" },
							},
						},
					},
					"400": {
						description: "Validation failed, the amount is zero, the Idempotency-Key is missing, or the balance would go negative.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": {
						description: "Wrong role or missing step-up.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"404": { $ref: "#/components/responses/NotFound" },
					"409": {
						description: "It is still processing, or the key was reused with a different body.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/analytics": {
			get: {
				tags: ["Admin"],
				operationId: "getAnalyticsReport",
				summary: "Read the KPI dashboard",
				description: "Analysts and super admins. Defaults to the last 30 days. GMV excludes cancelled, rejected and failed orders; commission is counted on completed orders only.",
				parameters: [
					{ name: "from", in: "query", schema: { type: "string", format: "date-time" } },
					{ name: "to", in: "query", schema: { type: "string", format: "date-time" } },
				],
				responses: {
					"200": {
						description: "Active orders, DAU, GMV, commission, delivery time, status counts and the daily series",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Analytics" },
							},
						},
					},
					"400": {
						description: "Invalid dates, or from is after to.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/reconciliation": {
			get: {
				tags: ["Admin"],
				operationId: "getReconciliationReport",
				summary: "Read payment, refund and payout totals",
				description: "Finance and super admins. Also lists payments stuck in the UNKNOWN state.",
				responses: {
					"200": {
						description: "Totals plus the UNKNOWN payments",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Reconciliation" },
							},
						},
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
		"/api/admin/settings": {
			get: {
				tags: ["Admin"],
				operationId: "getPlatformSettings",
				summary: "Read platform settings",
				description: "Super admins only.",
				responses: {
					"200": {
						description: "All settings",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SettingsResponse" },
							},
						},
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
			put: {
				tags: ["Admin"],
				operationId: "updatePlatformSettings",
				summary: "Update platform settings",
				description: "Super admins only. Numeric settings must be whole, non-negative numbers; the commission percentage cannot exceed 100. Each key may appear once.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/SettingsBody" },
						},
					},
				},
				responses: {
					"200": {
						description: "Settings saved and the full list returned",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/UpdateSettingsResponse" },
							},
						},
					},
					"400": {
						description: "Unknown key, duplicate key, or invalid value.",
						content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
					},
					"403": { $ref: "#/components/responses/Forbidden" },
					"429": { $ref: "#/components/responses/TooManyRequests" },
					"500": { $ref: "#/components/responses/ServerError" },
				},
			},
		},
	},
};
