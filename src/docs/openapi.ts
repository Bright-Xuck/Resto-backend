// OpenAPI description for the auth and admin APIs, served by Swagger UI at /docs.
export const openapi = {
	openapi: "3.0.3",
	info: {
		title: "Resto Backend API",
		version: "1.0.0",
		description:
			"Authentication, identity and administration API for the Resto multi-restaurant app.",
	},
	servers: [{ url: "http://localhost:5000" }],
	tags: [
		{ name: "Auth", description: "Registration, login and session endpoints" },
		{ name: "Admin", description: "Administration endpoints; every route needs an admin token" },
	],
	components: {
		parameters: {
			Page: {
				name: "page",
				in: "query",
				schema: { type: "integer", minimum: 1, default: 1 },
			},
			Limit: {
				name: "limit",
				in: "query",
				schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
			},
			Id: {
				name: "id",
				in: "path",
				required: true,
				schema: { type: "string", format: "uuid" },
			},
			IdempotencyKey: {
				name: "Idempotency-Key",
				in: "header",
				required: true,
				schema: { type: "string", maxLength: 200 },
				description: "A unique value per action. A retry with the same key replays the first response.",
			},
		},
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
				bearerFormat: "JWT",
			},
			refreshCookie: {
				type: "apiKey",
				in: "cookie",
				name: "refreshToken",
			},
		},
		schemas: {
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
					phone: { type: "string", example: "+237671234567" },
					code: { type: "string", example: "123456" },
					password: { type: "string", minLength: 8, example: "Password123!" },
					email: { type: "string", format: "email", example: "aicha@example.com" },
					locale: { type: "string", enum: ["en", "fr"], default: "en" },
					acceptedTerms: { type: "boolean", example: true },
				},
			},
			LoginBody: {
				type: "object",
				required: ["password"],
				properties: {
					email: { type: "string", format: "email", example: "jean@example.com" },
					phone: { type: "string", example: "+237671234567" },
					password: { type: "string", example: "Password123!" },
				},
			},
			OtpRequestBody: {
				type: "object",
				required: ["phone"],
				properties: { phone: { type: "string", example: "+237671234567" } },
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
					token: { type: "string" },
					newPassword: { type: "string", minLength: 8 },
				},
			},
			PhoneChangeVerifyBody: {
				type: "object",
				required: ["phone", "code"],
				properties: {
					phone: { type: "string", example: "+237671234567" },
					code: { type: "string", example: "123456" },
				},
			},
			User: {
				type: "object",
				properties: {
					id: { type: "string", format: "uuid" },
					type: { type: "string", enum: ["CUSTOMER", "MERCHANT", "RIDER", "ADMIN"] },
					status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED", "DELETED"] },
					email: { type: "string", nullable: true },
					phone: { type: "string", nullable: true },
					fullName: { type: "string" },
					locale: { type: "string", enum: ["en", "fr"] },
					emailVerifiedAt: { type: "string", format: "date-time", nullable: true },
					phoneVerifiedAt: { type: "string", format: "date-time", nullable: true },
					createdAt: { type: "string", format: "date-time" },
				},
			},
			SessionResponse: {
				type: "object",
				properties: {
					user: { $ref: "#/components/schemas/User" },
					accessToken: { type: "string" },
				},
			},
			MessageResponse: {
				type: "object",
				properties: { message: { type: "string" } },
			},
			ErrorResponse: {
				type: "object",
				properties: { message: { type: "string" } },
			},
			AdminUser: {
				allOf: [
					{ $ref: "#/components/schemas/User" },
					{
						type: "object",
						properties: {
							adminRole: {
								type: "string",
								nullable: true,
								enum: ["SUPER_ADMIN", "VERIFIER", "SUPPORT", "FINANCE", "ANALYST"],
							},
						},
					},
				],
			},
			MfaChallenge: {
				type: "object",
				properties: {
					mfaRequired: { type: "boolean", example: true },
					mfaSetupRequired: { type: "boolean", example: false },
					mfaToken: { type: "string" },
				},
			},
			MfaTokenBody: {
				type: "object",
				required: ["mfaToken"],
				properties: { mfaToken: { type: "string" } },
			},
			MfaCodeBody: {
				type: "object",
				required: ["mfaToken", "code"],
				properties: {
					mfaToken: { type: "string" },
					code: { type: "string", example: "123456" },
				},
			},
			StepUpBody: {
				type: "object",
				required: ["code"],
				properties: { code: { type: "string", example: "123456" } },
			},
			StatusBody: {
				type: "object",
				required: ["status", "reason"],
				properties: {
					status: { type: "string", enum: ["ACTIVE", "SUSPENDED", "BANNED"] },
					reason: { type: "string", minLength: 3, example: "Repeated policy violations" },
				},
			},
			DecisionBody: {
				type: "object",
				required: ["decision", "note"],
				properties: {
					decision: { type: "string", enum: ["APPROVE", "REJECT"] },
					note: { type: "string", minLength: 3, example: "Documents checked and valid" },
				},
			},
			ModerationActionBody: {
				type: "object",
				required: ["action", "note"],
				properties: {
					action: { type: "string", enum: ["FLAG", "HIDE", "RESTORE", "REMOVE"] },
					note: { type: "string", minLength: 3 },
				},
			},
			RefundBody: {
				type: "object",
				required: ["amountFcfa", "reason"],
				properties: {
					amountFcfa: { type: "integer", minimum: 1, example: 2500 },
					reason: { type: "string", minLength: 3, example: "Order arrived cold" },
				},
			},
			ReassignBody: {
				type: "object",
				required: ["riderId", "reason"],
				properties: {
					riderId: { type: "string", format: "uuid" },
					reason: { type: "string", minLength: 3, example: "Original rider had a breakdown" },
				},
			},
			WalletAdjustBody: {
				type: "object",
				required: ["amountFcfa", "reason"],
				properties: {
					amountFcfa: {
						type: "integer",
						example: 1000,
						description: "Positive adds money, negative removes it. The balance cannot go below zero.",
					},
					reason: { type: "string", minLength: 3 },
				},
			},
			SettingsBody: {
				type: "object",
				required: ["settings"],
				properties: {
					settings: {
						type: "array",
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
								value: { type: "string", example: "1500" },
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
		},
	},
	paths: {
		"/health": {
			get: {
				summary: "Health check",
				responses: { "200": { description: "Server is running" } },
			},
		},
		"/api/auth/register": {
			post: {
				tags: ["Auth"],
				summary: "Create a customer or merchant account",
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
						description: "Account created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
							},
						},
					},
					"400": { description: "Validation error" },
					"409": { description: "Email already registered" },
				},
			},
		},
		"/api/auth/otp/request": {
			post: {
				tags: ["Auth"],
				summary: "Send a rider signup code",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/OtpRequestBody" },
						},
					},
				},
				responses: {
					"200": { description: "Code sent" },
					"409": { description: "Phone already registered" },
					"429": { description: "Cooldown or rate limit" },
				},
			},
		},
		"/api/auth/register/rider": {
			post: {
				tags: ["Auth"],
				summary: "Verify the code and create a rider account",
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
						description: "Rider created",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
							},
						},
					},
					"400": { description: "Invalid code" },
					"409": { description: "Phone or email already registered" },
					"429": { description: "Too many attempts" },
				},
			},
		},
		"/api/auth/login": {
			post: {
				tags: ["Auth"],
				summary: "Log in with email or phone",
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
						description:
							"Logged in, or an admin MFA challenge with mfaRequired and mfaToken",
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
					"401": { description: "Wrong credentials" },
					"423": { description: "Account locked" },
				},
			},
		},
		"/api/auth/refresh": {
			post: {
				tags: ["Auth"],
				summary: "Rotate the refresh token and return a new access token",
				security: [{ refreshCookie: [] }],
				responses: {
					"200": { description: "New access token and rotated refresh cookie" },
					"401": { description: "Missing, expired, revoked or reused token" },
				},
			},
		},
		"/api/auth/logout": {
			post: {
				tags: ["Auth"],
				summary: "Revoke the current refresh token",
				security: [{ refreshCookie: [] }],
				responses: {
					"200": {
						description: "Logged out",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/MessageResponse" },
							},
						},
					},
				},
			},
		},
		"/api/auth/logout-all": {
			post: {
				tags: ["Auth"],
				summary: "Revoke every session for the signed-in user",
				security: [{ bearerAuth: [] }],
				responses: { "200": { description: "Logged out of all devices" } },
			},
		},
		"/api/auth/forgot-password": {
			post: {
				tags: ["Auth"],
				summary: "Request a password reset link",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ForgotPasswordBody" },
						},
					},
				},
				responses: { "200": { description: "Reset link sent if the email exists" } },
			},
		},
		"/api/auth/reset-password": {
			post: {
				tags: ["Auth"],
				summary: "Set a new password with a reset token",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/ResetPasswordBody" },
						},
					},
				},
				responses: {
					"200": { description: "Password updated" },
					"400": { description: "Invalid or used token" },
				},
			},
		},
		"/api/auth/phone/change/request": {
			post: {
				tags: ["Auth"],
				summary: "Send a code before changing a rider phone number",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/OtpRequestBody" },
						},
					},
				},
				responses: {
					"200": { description: "Code sent" },
					"403": { description: "Rider only" },
					"409": { description: "Phone already registered" },
				},
			},
		},
		"/api/auth/phone/change/verify": {
			post: {
				tags: ["Auth"],
				summary: "Verify the code and update the rider phone number",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/PhoneChangeVerifyBody" },
						},
					},
				},
				responses: {
					"200": { description: "Phone updated" },
					"400": { description: "Invalid code" },
					"403": { description: "Rider only" },
				},
			},
		},
		"/api/auth/me": {
			get: {
				tags: ["Auth"],
				summary: "Return the signed-in user",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": {
						description: "Current user",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										user: { $ref: "#/components/schemas/User" },
									},
								},
							},
						},
					},
					"401": { description: "Missing or invalid token" },
				},
			},
		},
		"/api/auth/admin/mfa/setup": {
			post: {
				tags: ["Auth"],
				summary: "Start admin two-factor enrolment",
				description: "Uses the short-lived mfaToken returned by an admin login. Returns a TOTP secret and otpauth URI.",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MfaTokenBody" },
						},
					},
				},
				responses: {
					"200": { description: "Secret and otpauth URI" },
					"400": { description: "Setup already completed" },
					"401": { description: "Invalid or expired mfaToken" },
				},
			},
		},
		"/api/auth/admin/mfa/enable": {
			post: {
				tags: ["Auth"],
				summary: "Confirm the first code and open the admin session",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/MfaCodeBody" },
						},
					},
				},
				responses: {
					"200": { description: "Session, access token and eight recovery codes" },
					"401": { description: "Wrong code or expired mfaToken" },
				},
			},
		},
		"/api/auth/admin/mfa/verify": {
			post: {
				tags: ["Auth"],
				summary: "Complete an admin login with a TOTP or recovery code",
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
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
							},
						},
					},
					"401": { description: "Wrong code or expired mfaToken" },
				},
			},
		},
		"/api/auth/admin/mfa/disable": {
			post: {
				tags: ["Auth"],
				summary: "Turn two-factor authentication off",
				description: "Requires the current password and a valid code. Admin token required.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["password", "code"],
								properties: {
									password: { type: "string" },
									code: { type: "string", example: "123456" },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Two-factor authentication disabled" },
					"401": { description: "Wrong password or code" },
				},
			},
		},
		"/api/auth/admin/step-up": {
			post: {
				tags: ["Auth"],
				summary: "Confirm a sensitive action and get a stepped-up access token",
				description: "The new token carries stepUpAt and is valid for five minutes on sensitive routes.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/StepUpBody" },
						},
					},
				},
				responses: {
					"200": { description: "New access token with stepUpAt" },
					"401": { description: "Wrong code" },
				},
			},
		},
		"/api/admin/audit": {
			get: {
				tags: ["Admin"],
				summary: "Read the append-only audit log",
				description: "Super admins only. Rows cannot be edited or deleted.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "action", in: "query", schema: { type: "string" } },
					{ name: "targetType", in: "query", schema: { type: "string" } },
					{ name: "targetId", in: "query", schema: { type: "string" } },
					{ name: "actorId", in: "query", schema: { type: "string", format: "uuid" } },
					{ name: "from", in: "query", schema: { type: "string", format: "date-time" } },
					{ name: "to", in: "query", schema: { type: "string", format: "date-time" } },
				],
				responses: {
					"200": { description: "One page of audit rows" },
					"403": { description: "Not a super admin" },
				},
			},
		},
		"/api/admin/users": {
			get: {
				tags: ["Admin"],
				summary: "Search accounts across every role",
				description: "Support and super admins.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "q", in: "query", schema: { type: "string" }, description: "Name, email or phone" },
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
				responses: { "200": { description: "One page of accounts" } },
			},
		},
		"/api/admin/users/{id}": {
			get: {
				tags: ["Admin"],
				summary: "Load one account with wallet and activity counts",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": { description: "The account" },
					"404": { description: "Account not found" },
				},
			},
		},
		"/api/admin/users/{id}/status": {
			patch: {
				tags: ["Admin"],
				summary: "Suspend, ban or reactivate an account",
				description: "Support may suspend; only a super admin may ban, and a ban needs step-up.",
				security: [{ bearerAuth: [] }],
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
					"200": { description: "Status updated" },
					"400": { description: "Invalid change, such as the last super admin" },
					"403": { description: "Not allowed for this role, or step-up missing" },
				},
			},
		},
		"/api/admin/users/{id}/credential-reset": {
			post: {
				tags: ["Admin"],
				summary: "Reset an account password and sign it out everywhere",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": { description: "Returns the temporary password once" },
					"403": { description: "Only a super admin may reset another admin" },
				},
			},
		},
		"/api/admin/admins": {
			get: {
				tags: ["Admin"],
				summary: "List admin accounts",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
				],
				responses: { "200": { description: "Admin accounts" } },
			},
			post: {
				tags: ["Admin"],
				summary: "Create an admin account",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/CreateAdminBody" },
						},
					},
				},
				responses: {
					"201": { description: "Admin created; MFA setup is required at first login" },
					"409": { description: "Email already used" },
				},
			},
		},
		"/api/admin/admins/{id}/role": {
			patch: {
				tags: ["Admin"],
				summary: "Change an admin sub-role",
				description: "Signs the admin out so old tokens cannot keep the old role.",
				security: [{ bearerAuth: [] }],
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
					"200": { description: "Role updated" },
					"400": { description: "Cannot remove the last super admin" },
				},
			},
		},
		"/api/admin/applications": {
			get: {
				tags: ["Admin"],
				summary: "List merchant or rider applications",
				security: [{ bearerAuth: [] }],
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
				responses: { "200": { description: "One page of applications" } },
			},
		},
		"/api/admin/applications/{type}/{id}": {
			get: {
				tags: ["Admin"],
				summary: "Load one application with its documents",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "type",
						in: "path",
						required: true,
						schema: { type: "string", enum: ["merchant", "rider"] },
					},
					{ $ref: "#/components/parameters/Id" },
				],
				responses: {
					"200": { description: "The application" },
					"404": { description: "Application not found" },
				},
			},
		},
		"/api/admin/applications/{type}/{id}/decision": {
			post: {
				tags: ["Admin"],
				summary: "Approve or reject an application",
				description: "Requires an Idempotency-Key. Approval creates the restaurant or verifies the rider.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{
						name: "type",
						in: "path",
						required: true,
						schema: { type: "string", enum: ["merchant", "rider"] },
					},
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
					"200": { description: "Decision saved" },
					"400": { description: "Missing Idempotency-Key" },
					"409": { description: "Already reviewed or key reused with a different body" },
				},
			},
		},
		"/api/admin/moderation": {
			get: {
				tags: ["Admin"],
				summary: "List reported content",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "status", in: "query", schema: { type: "string", enum: ["OPEN", "RESOLVED"] } },
				],
				responses: { "200": { description: "One page of reports with their targets" } },
			},
		},
		"/api/admin/moderation/{id}/action": {
			post: {
				tags: ["Admin"],
				summary: "Flag, hide, restore or remove reported content",
				description: "Requires an Idempotency-Key. The report is resolved in the same transaction.",
				security: [{ bearerAuth: [] }],
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
					"200": { description: "Report resolved" },
					"409": { description: "Report already resolved" },
				},
			},
		},
		"/api/admin/restaurants": {
			get: {
				tags: ["Admin"],
				summary: "List restaurant listings",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ $ref: "#/components/parameters/Page" },
					{ $ref: "#/components/parameters/Limit" },
					{ name: "q", in: "query", schema: { type: "string" } },
					{
						name: "status",
						in: "query",
						schema: { type: "string", enum: ["PENDING", "APPROVED", "SUSPENDED"] },
					},
				],
				responses: { "200": { description: "One page of restaurants" } },
			},
		},
		"/api/admin/restaurants/{id}": {
			get: {
				tags: ["Admin"],
				summary: "Load one restaurant with its owner and menu",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": { description: "The restaurant and its menu items" },
					"404": { description: "Restaurant not found" },
				},
			},
		},
		"/api/admin/menu-items/{id}": {
			patch: {
				tags: ["Admin"],
				summary: "Edit a menu item",
				description: "Correct the name, price or availability of a menu item.",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								properties: {
									name: { type: "string", minLength: 2, maxLength: 120 },
									priceFcfa: { type: "integer", minimum: 0 },
									isAvailable: { type: "boolean" },
								},
							},
						},
					},
				},
				responses: {
					"200": { description: "Menu item updated" },
					"400": { description: "No fields sent or invalid values" },
					"404": { description: "Menu item not found" },
				},
			},
		},
		"/api/admin/restaurants/{id}/status": {
			patch: {
				tags: ["Admin"],
				summary: "Suspend or restore a restaurant listing",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["status", "note"],
								properties: {
									status: { type: "string", enum: ["APPROVED", "SUSPENDED"] },
									note: { type: "string", minLength: 3 },
								},
							},
						},
					},
				},
				responses: { "200": { description: "Status updated" } },
			},
		},
		"/api/admin/orders/{id}/timeline": {
			get: {
				tags: ["Admin"],
				summary: "Read an order's log, payment and rider location",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: {
					"200": { description: "Order timeline" },
					"404": { description: "Order not found" },
				},
			},
		},
		"/api/admin/orders/{id}/refund": {
			post: {
				tags: ["Admin"],
				summary: "Refund part or all of an online payment",
				description: "Finance only. Requires a stepped-up token and an Idempotency-Key.",
				security: [{ bearerAuth: [] }],
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
					"200": { description: "Refund recorded" },
					"400": { description: "No payment or amount above the remaining balance" },
					"403": { description: "Missing step-up or wrong role" },
				},
			},
		},
		"/api/admin/orders/{id}/reassign": {
			post: {
				tags: ["Admin"],
				summary: "Move an active order to another verified rider",
				description: "Finance only. Requires an Idempotency-Key.",
				security: [{ bearerAuth: [] }],
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
					"200": { description: "Order reassigned" },
					"400": { description: "Order closed, rider not verified or already assigned" },
				},
			},
		},
		"/api/admin/wallets/{id}": {
			get: {
				tags: ["Admin"],
				summary: "Load a wallet and its latest ledger entries",
				security: [{ bearerAuth: [] }],
				parameters: [{ $ref: "#/components/parameters/Id" }],
				responses: { "200": { description: "The wallet" } },
			},
		},
		"/api/admin/wallets/{id}/adjust": {
			post: {
				tags: ["Admin"],
				summary: "Add or remove money from a wallet",
				description: "Finance only. Requires a stepped-up token and an Idempotency-Key.",
				security: [{ bearerAuth: [] }],
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
					"200": { description: "Wallet adjusted and ledger row written" },
					"400": { description: "Adjustment would make the balance negative" },
				},
			},
		},
		"/api/admin/analytics": {
			get: {
				tags: ["Admin"],
				summary: "Read the KPI dashboard",
				description: "Analysts and super admins. Defaults to the last 30 days.",
				security: [{ bearerAuth: [] }],
				parameters: [
					{ name: "from", in: "query", schema: { type: "string", format: "date-time" } },
					{ name: "to", in: "query", schema: { type: "string", format: "date-time" } },
				],
				responses: {
					"200": { description: "Active orders, DAU, GMV, commission, delivery time and daily series" },
				},
			},
		},
		"/api/admin/reconciliation": {
			get: {
				tags: ["Admin"],
				summary: "Read payment, refund and payout totals",
				security: [{ bearerAuth: [] }],
				responses: {
					"200": { description: "Totals plus payments in the UNKNOWN state" },
				},
			},
		},
		"/api/admin/settings": {
			get: {
				tags: ["Admin"],
				summary: "Read platform settings",
				security: [{ bearerAuth: [] }],
				responses: { "200": { description: "All settings" } },
			},
			put: {
				tags: ["Admin"],
				summary: "Update platform settings",
				description: "Super admins only. Numeric settings must be whole, non-negative numbers.",
				security: [{ bearerAuth: [] }],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: { $ref: "#/components/schemas/SettingsBody" },
						},
					},
				},
				responses: {
					"200": { description: "Settings saved" },
					"400": { description: "Unknown key or invalid value" },
				},
			},
		},
	},
};
