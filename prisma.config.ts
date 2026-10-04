import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({ schema: "prisma/schema.prisma", migrations: { path: "prisma/migrations" }, datasource: { url: process.env.DATABASE_URL ?? "postgresql://devquest:devquest_local@localhost:5432/devquest" } });
