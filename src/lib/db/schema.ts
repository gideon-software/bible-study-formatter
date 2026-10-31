import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";

export const executions = pgTable(
  "executions",
  {
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
  },
  (table) => [
    index("executions_user_created_idx").on(table.userEmail, table.createdAt),
    index("executions_created_at_idx").on(table.createdAt),
    index("executions_doc_id_idx").on(table.docId),
    index("executions_book_name_idx").on(table.bookName),
    index("executions_version_idx").on(table.versionAbbr),
  ]
);

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

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userEmail: varchar("user_email", { length: 255 }).unique().notNull(),
  defaultVersion: varchar("default_version", { length: 20 }).default("ESV"),
  defaultOptionsJson: json("default_options_json").notNull(),
  lastBookId: varchar("last_book_id", { length: 10 }),
  lastChapterStart: integer("last_chapter_start"),
  lastChapterEnd: integer("last_chapter_end"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: serial("id").primaryKey(),
    userEmail: varchar("user_email", { length: 255 }).notNull(),
    eventType: varchar("event_type", { length: 50 }).notNull(), // "doc_generation" | "uncached_chapter"
    units: integer("units").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rate_limit_events_user_created_idx").on(
      table.userEmail,
      table.createdAt
    ),
    index("rate_limit_events_created_idx").on(table.createdAt),
  ]
);

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
export type MissingElement = typeof missingElements.$inferSelect;
export type NewMissingElement = typeof missingElements.$inferInsert;
export type UserPreference = typeof userPreferences.$inferSelect;
export type NewUserPreference = typeof userPreferences.$inferInsert;
export type RateLimitEvent = typeof rateLimitEvents.$inferSelect;
export type NewRateLimitEvent = typeof rateLimitEvents.$inferInsert;
