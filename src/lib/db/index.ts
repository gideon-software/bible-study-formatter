import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;

export const db = (connectionString
  ? drizzle(neon(connectionString), { schema })
  : null) as unknown as AppDatabase;

export function isDbConnected(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
