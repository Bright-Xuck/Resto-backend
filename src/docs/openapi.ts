// OpenAPI description for the auth API, served by Swagger UI at /docs.
export const openapi = {
	openapi: "3.0.3",
	info: {
		title: "Resto Backend API",
		version: "1.0.0",
		description: "Authentication and identity API for the Resto multi-restaurant app.",
	},
	servers: [{ url: "http://localhost:5000" }],
	tags: [{ name: "Auth", description: "Registration, login and session endpoints" }],
	components: {
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
						description: "Logged in",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/SessionResponse" },
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
	},
};
