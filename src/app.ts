import cookieParser from "cookie-parser";
import express, { type Application } from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./docs/openapi.ts";
import adminRoutes from "./routes/admin.routes.ts";
import authRoutes from "./routes/auth.routes.ts";

const app: Application = express();

// Read the client IP from the proxy so rate limiting works in production.
app.set("trust proxy", 1);

// Add standard security headers. CSP is off because Swagger UI uses inline scripts.
app.use(helmet({ contentSecurityPolicy: false }));

// Log every request in a short format during development.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Parse JSON request bodies.
app.use(express.json());

// Parse the refresh token from the request cookies.
app.use(cookieParser());

// Interactive API documentation.
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

// Simple check that the server is alive.
app.get("/health", (req, res) => {
	res.json({ ok: "ok", message: "The server is running" });
});

// All authentication endpoints.
app.use("/api/auth", authRoutes);

// Admin dashboard endpoints. authenticate runs inside the router.
app.use("/api/admin", adminRoutes);

// Custom response for routes that do not exist.
app.use((req, res) => {
	res.status(404).json({ message: "Route not found" });
});

export default app;
