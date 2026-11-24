import { Router } from "express";
import {
	forgotPasswordUser,
	getMe,
	loginUser,
	logoutAllDevices,
	logoutUser,
	refreshSession,
	registerRiderUser,
	registerUser,
	requestOtp,
	requestPhoneChangeCode,
	resetPasswordUser,
	verifyPhoneChangeCode,
} from "../controllers/auth.controller.ts";
import { authenticate } from "../middlewares/authenticate.ts";
import { riderOnly } from "../middlewares/RBA.ts";
import { rateLimit } from "../middlewares/rateLimit.ts";

const router = Router();

// Creates a customer or merchant account.
router.post("/register", rateLimit(10, 3600, "register"), registerUser);

// Sends a rider signup verification code.
router.post("/otp/request", rateLimit(5, 900, "otp-request"), requestOtp);

// Verifies the code and creates a rider account.
router.post("/register/rider", rateLimit(5, 900, "rider-register"), registerRiderUser);

// Logs in with an email or phone number.
router.post("/login", rateLimit(10, 900, "login"), loginUser);

// Rotates the refresh cookie and returns a new access token.
router.post("/refresh", rateLimit(30, 900, "refresh"), refreshSession);

// Revokes the current refresh token and clears the cookie.
router.post("/logout", rateLimit(30, 900, "logout"), logoutUser);

// Revokes every refresh token for the signed-in user.
router.post("/logout-all", authenticate, rateLimit(10, 900, "logout-all"), logoutAllDevices);

// Sends a password reset link.
router.post("/forgot-password", rateLimit(5, 900, "forgot-password"), forgotPasswordUser);

// Sets a new password with a reset token.
router.post("/reset-password", rateLimit(5, 900, "reset-password"), resetPasswordUser);

// Sends a code before a rider changes their phone number.
router.post(
	"/phone/change/request",
	authenticate,
	riderOnly,
	rateLimit(5, 900, "phone-change-request"),
	requestPhoneChangeCode,
);

// Verifies the code and updates the rider phone number.
router.post(
	"/phone/change/verify",
	authenticate,
	riderOnly,
	rateLimit(5, 900, "phone-change-verify"),
	verifyPhoneChangeCode,
);

// Returns the signed-in user's profile. authenticate checks the access token.
router.get("/me", authenticate, rateLimit(60, 900, "me"), getMe);

export default router;
