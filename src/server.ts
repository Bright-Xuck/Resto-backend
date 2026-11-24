import "dotenv/config";

// ESM resolves local imports using the compiled .js extension, even from .ts sources.
import app from "./app.ts";

const PORT = Number(process.env.PORT) || 5000;

// Starts the HTTP server.
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
