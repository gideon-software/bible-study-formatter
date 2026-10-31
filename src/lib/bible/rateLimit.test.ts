import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import {
  acquireInFlightLock,
  releaseInFlightLock,
  clearInFlightLocks,
  isAdminUser,
  evaluateRateLimits,
  RateEvent,
} from "./rateLimit";

describe("rateLimit - In-Flight Concurrency", () => {
  const user = "testuser@example.com";

  beforeEach(() => {
    clearInFlightLocks();
  });

  it("allows up to 2 concurrent in-flight generations", () => {
    const lock1 = acquireInFlightLock(user);
    assert.strictEqual(lock1.allowed, true);
    assert.strictEqual(lock1.activeCount, 1);

    const lock2 = acquireInFlightLock(user);
    assert.strictEqual(lock2.allowed, true);
    assert.strictEqual(lock2.activeCount, 2);

    const lock3 = acquireInFlightLock(user);
    assert.strictEqual(lock3.allowed, false);
    assert.strictEqual(lock3.activeCount, 2);
  });

  it("releases in-flight lock allowing new generation", () => {
    acquireInFlightLock(user);
    acquireInFlightLock(user);
    assert.strictEqual(acquireInFlightLock(user).allowed, false);

    releaseInFlightLock(user);
    const retry = acquireInFlightLock(user);
    assert.strictEqual(retry.allowed, true);
  });

  it("expires locks older than TTL", () => {
    acquireInFlightLock(user, 2, 50); // 50ms TTL
    acquireInFlightLock(user, 2, 50);
    assert.strictEqual(acquireInFlightLock(user, 2, 50).allowed, false);

    // Simulate passage of time by passing ttlMs = 0
    const retry = acquireInFlightLock(user, 2, 0);
    assert.strictEqual(retry.allowed, true);
  });
});

describe("rateLimit - isAdminUser", () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = "admin@example.com, HallMentzer@gmail.com ";
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it("recognizes admins case-insensitively and with whitespace", () => {
    assert.strictEqual(isAdminUser("admin@example.com"), true);
    assert.strictEqual(isAdminUser("hallmentzer@gmail.com"), true);
    assert.strictEqual(isAdminUser("HALLMENTZER@GMAIL.COM"), true);
    assert.strictEqual(isAdminUser("other@example.com"), false);
  });
});

describe("rateLimit - evaluateRateLimits", () => {
  const baseNow = new Date("2026-10-27T12:00:00Z");

  it("allows generation when no prior events exist", () => {
    const result = evaluateRateLimits({
      events: [],
      requestedUncachedCount: 5,
      now: baseNow,
    });
    assert.strictEqual(result.allowed, true);
  });

  it("blocks on burst limit (4 docs in 5 minutes)", () => {
    const events: RateEvent[] = [
      { eventType: "doc_generation", units: 1, createdAt: new Date("2026-10-27T11:56:00Z") },
      { eventType: "doc_generation", units: 1, createdAt: new Date("2026-10-27T11:57:00Z") },
      { eventType: "doc_generation", units: 1, createdAt: new Date("2026-10-27T11:58:00Z") },
      { eventType: "doc_generation", units: 1, createdAt: new Date("2026-10-27T11:59:00Z") },
    ];

    const result = evaluateRateLimits({
      events,
      requestedUncachedCount: 1,
      now: baseNow,
    });

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.error, "Rate Limit Exceeded");
    assert.match(result.message!, /You've created several documents recently\. Please wait about \d+ minute/);
    assert.match(result.details!, /Bible publishers set limits/);
  });

  it("blocks on hourly document limit (10 docs in 60 minutes)", () => {
    // 10 docs spread across the hour (not triggering 5m burst)
    const events: RateEvent[] = [];
    for (let i = 0; i < 10; i++) {
      events.push({
        eventType: "doc_generation",
        units: 1,
        createdAt: new Date(baseNow.getTime() - (50 - i * 5) * 60 * 1000),
      });
    }

    const result = evaluateRateLimits({
      events,
      requestedUncachedCount: 1,
      now: baseNow,
    });

    assert.strictEqual(result.allowed, false);
    assert.match(result.details!, /limit of 10 documents created in one hour/);
  });

  it("blocks on hourly uncached chapters limit (>60 uncached chapters)", () => {
    const events: RateEvent[] = [
      { eventType: "uncached_chapter", units: 50, createdAt: new Date("2026-10-27T11:30:00Z") },
    ];

    // Requesting 15 uncached chapters when 50 already downloaded -> 65 total > 60
    const result = evaluateRateLimits({
      events,
      requestedUncachedCount: 15,
      now: baseNow,
    });

    assert.strictEqual(result.allowed, false);
    assert.match(result.details!, /Bible publishers set hourly limits on how many chapters can be downloaded/);
  });

  it("allows cached requests even if hourly uncached chapter quota was reached", () => {
    const events: RateEvent[] = [
      { eventType: "uncached_chapter", units: 60, createdAt: new Date("2026-10-27T11:30:00Z") },
    ];

    // Requesting 0 uncached chapters (all chapters cached in DB)
    const result = evaluateRateLimits({
      events,
      requestedUncachedCount: 0,
      now: baseNow,
    });

    assert.strictEqual(result.allowed, true);
  });
});
