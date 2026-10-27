import { db } from "@/lib/db";
import { rateLimitEvents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export interface RateLimitResult {
  allowed: boolean;
  error?: string;
  message?: string;
  details?: string;
  retryAfterSeconds?: number;
}

export interface RateEvent {
  eventType: string;
  units: number;
  createdAt: Date;
}

// In-flight concurrency tracker
interface InFlightEntry {
  timestamps: number[];
}

const inFlightMap = new Map<string, InFlightEntry>();
const IN_FLIGHT_TTL_MS = 60_000; // 60-second safeguard auto-reset
const MAX_CONCURRENT = 2; // Allow up to 2 concurrent generations per user

export function acquireInFlightLock(
  userEmail: string,
  maxConcurrent = MAX_CONCURRENT,
  ttlMs = IN_FLIGHT_TTL_MS
): { allowed: boolean; activeCount: number } {
  const key = userEmail.toLowerCase().trim();
  const now = Date.now();
  const entry = inFlightMap.get(key) || { timestamps: [] };

  // Filter out any timestamps older than TTL
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < ttlMs);

  if (entry.timestamps.length >= maxConcurrent) {
    inFlightMap.set(key, entry);
    return { allowed: false, activeCount: entry.timestamps.length };
  }

  entry.timestamps.push(now);
  inFlightMap.set(key, entry);
  return { allowed: true, activeCount: entry.timestamps.length };
}

export function releaseInFlightLock(userEmail: string): void {
  const key = userEmail.toLowerCase().trim();
  const entry = inFlightMap.get(key);
  if (!entry || entry.timestamps.length === 0) return;

  // Remove the oldest in-flight timestamp
  entry.timestamps.shift();
  if (entry.timestamps.length === 0) {
    inFlightMap.delete(key);
  } else {
    inFlightMap.set(key, entry);
  }
}

// Clear all in-flight locks (useful for testing)
export function clearInFlightLocks(): void {
  inFlightMap.clear();
}

export function isAdminUser(userEmail: string): boolean {
  if (!userEmail) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(userEmail.toLowerCase().trim());
}

/**
 * Pure function to evaluate rate limit rules against a list of events.
 * Enables 100% deterministic unit testing without database dependencies.
 */
export function evaluateRateLimits({
  events,
  requestedUncachedCount,
  now = new Date(),
}: {
  events: RateEvent[];
  requestedUncachedCount: number;
  now?: Date;
}): RateLimitResult {
  const nowMs = now.getTime();
  const fiveMinAgoMs = nowMs - 5 * 60 * 1000;
  const sixtyMinAgoMs = nowMs - 60 * 60 * 1000;

  // Filter events within last 60 minutes
  const recentEvents = events.filter(
    (e) => e.createdAt.getTime() > sixtyMinAgoMs
  );

  // 1. Burst Check: Max 4 doc generations in last 5 minutes
  const recent5mDocs = recentEvents
    .filter(
      (e) =>
        e.eventType === "doc_generation" &&
        e.createdAt.getTime() > fiveMinAgoMs
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (recent5mDocs.length >= 4) {
    const oldest = recent5mDocs[0];
    const waitMs = Math.max(1000, oldest.createdAt.getTime() + 5 * 60 * 1000 - nowMs);
    const waitMinutes = Math.ceil(waitMs / 60000);
    return {
      allowed: false,
      error: "Rate Limit Exceeded",
      message: `You've created several documents recently. Please wait about ${waitMinutes} minute${
        waitMinutes === 1 ? "" : "s"
      } before creating another.`,
      details:
        "Bible publishers set limits on how frequently documents can be generated. Please pause briefly before your next request.",
      retryAfterSeconds: Math.ceil(waitMs / 1000),
    };
  }

  // 2. Hourly Document Allowance: Max 10 docs in last 60 minutes
  const recent60mDocs = recentEvents
    .filter((e) => e.eventType === "doc_generation")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (recent60mDocs.length >= 10) {
    const oldest = recent60mDocs[0];
    const waitMs = Math.max(1000, oldest.createdAt.getTime() + 60 * 60 * 1000 - nowMs);
    const waitMinutes = Math.ceil(waitMs / 60000);
    return {
      allowed: false,
      error: "Rate Limit Exceeded",
      message: `You've created several documents recently. Please wait about ${waitMinutes} minute${
        waitMinutes === 1 ? "" : "s"
      } before creating another.`,
      details: `You have reached the limit of 10 documents created in one hour. This limit will reset in ${waitMinutes} minute${
        waitMinutes === 1 ? "" : "s"
      }.`,
      retryAfterSeconds: Math.ceil(waitMs / 1000),
    };
  }

  // 3. Hourly Uncached Chapters Allowance: Max 60 uncached chapters in last 60 minutes
  const uncachedEvents = recentEvents
    .filter((e) => e.eventType === "uncached_chapter")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const currentUncachedSum = uncachedEvents.reduce((sum, e) => sum + e.units, 0);

  if (currentUncachedSum + requestedUncachedCount > 60) {
    const oldest = uncachedEvents[0] || { createdAt: new Date(sixtyMinAgoMs) };
    const waitMs = Math.max(1000, oldest.createdAt.getTime() + 60 * 60 * 1000 - nowMs);
    const waitMinutes = Math.ceil(waitMs / 60000);
    return {
      allowed: false,
      error: "Rate Limit Exceeded",
      message: `You've created several documents recently. Please wait about ${waitMinutes} minute${
        waitMinutes === 1 ? "" : "s"
      } before creating another.`,
      details:
        "Bible publishers set hourly limits on how many chapters can be downloaded. Passages that have already been formatted in this app are saved and don't count heavily against this limit, but new downloads are temporarily paused for your account.",
      retryAfterSeconds: Math.ceil(waitMs / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Checks all rate limits (concurrency, burst, hourly doc allowance, hourly uncached chapters).
 * If allowed, locks an in-flight slot which caller must release via `releaseInFlightLock(userEmail)`.
 */
export async function checkRateLimit({
  userEmail,
  requestedUncachedCount,
}: {
  userEmail: string;
  requestedUncachedCount: number;
}): Promise<RateLimitResult> {
  // 1. Admins are completely exempt
  if (isAdminUser(userEmail)) {
    return { allowed: true };
  }

  // 2. In-Flight Concurrency Check (max 2 active at a time)
  const lock = acquireInFlightLock(userEmail);
  if (!lock.allowed) {
    return {
      allowed: false,
      error: "Concurrent Generation Limit",
      message:
        "A document is already being created for your account. Please wait for it to finish.",
      details:
        "To protect server stability, a maximum of 2 documents can be generated simultaneously per account.",
      retryAfterSeconds: 5,
    };
  }

  // If no DB connection, concurrency lock is the only check
  if (!db) {
    return { allowed: true };
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const events = await db
      .select({
        eventType: rateLimitEvents.eventType,
        units: rateLimitEvents.units,
        createdAt: rateLimitEvents.createdAt,
      })
      .from(rateLimitEvents)
      .where(
        sql`${rateLimitEvents.userEmail} = ${userEmail.toLowerCase().trim()} AND ${rateLimitEvents.createdAt} > ${oneHourAgo}`
      );

    const result = evaluateRateLimits({
      events,
      requestedUncachedCount,
    });

    if (!result.allowed) {
      // Release in-flight lock since request is rejected
      releaseInFlightLock(userEmail);
    }

    return result;
  } catch (err) {
    console.warn("[RateLimit] Error checking rate limits, failing open:", err);
    return { allowed: true };
  }
}

/**
 * Records generation and uncached chapter events to Neon Postgres.
 */
export async function recordRateLimitEvents({
  userEmail,
  uncachedChaptersCount,
}: {
  userEmail: string;
  uncachedChaptersCount: number;
}): Promise<void> {
  if (!db || !userEmail) return;

  try {
    const emailKey = userEmail.toLowerCase().trim();

    // 1. Record document generation event
    await db.insert(rateLimitEvents).values({
      userEmail: emailKey,
      eventType: "doc_generation",
      units: 1,
    });

    // 2. If uncached chapters were downloaded, record them
    if (uncachedChaptersCount > 0) {
      await db.insert(rateLimitEvents).values({
        userEmail: emailKey,
        eventType: "uncached_chapter",
        units: uncachedChaptersCount,
      });
    }

    // 3. Asynchronously prune events older than 24 hours
    await db
      .delete(rateLimitEvents)
      .where(sql`${rateLimitEvents.createdAt} < NOW() - INTERVAL '24 hours'`);
  } catch (err) {
    console.warn("[RateLimit] Error recording rate limit events:", err);
  }
}
