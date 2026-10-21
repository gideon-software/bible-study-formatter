import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";

export const executions = pgTable("executions", {
  id: serial("id").primaryKey(),
  userEmail: varchar("user_email", { length: 255 }),
  versionAbbr: varchar("version_abbr", { length: 20 }).notNull(),
  bookId: varchar("book_id", { length: 10 }).notNull(),
  bookName: varchar("book_name", { length: 100 }).notNull(),
  chapterStart: integer("chapter_start").notNull(),
  chapterEnd: integer("chapter_end").notNull(),
  docId: varchar("doc_id", { length: 255 }),
  docUrl: text("doc_url"),
  optionsJson: json("options_json"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const missingElements = pgTable("missing_elements", {
  id: serial("id").primaryKey(),
  className: varchar("class_name", { length: 100 }).notNull(),
  versionAbbr: varchar("version_abbr", { length: 20 }).notNull(),
  bookName: varchar("book_name", { length: 100 }).notNull(),
  chapterNum: integer("chapter_num"),
  snippet: text("snippet"),
  occurrenceCount: integer("occurrence_count").default(1).notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const bibleCache = pgTable("bible_cache", {
  id: serial("id").primaryKey(),
  passageKey: varchar("passage_key", { length: 100 }).unique().notNull(), // e.g. "ESV/JHN/1"
  contentJson: json("content_json").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type MissingElement = typeof missingElements.$inferSelect;
export type NewMissingElement = typeof missingElements.$inferInsert;
