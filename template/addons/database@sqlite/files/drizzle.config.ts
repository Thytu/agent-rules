import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/db/schema.ts",
	out: "./db/migrations",
	migrations: { prefix: "timestamp" },
});
