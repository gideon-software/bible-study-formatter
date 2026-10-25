import { describe, it } from "node:test";
import assert from "node:assert";
import {
  BIBLE_BOOKS,
  getBookById,
  getBookChapters,
  getDocTitle,
  validateEsvPassageRange,
} from "./books";

describe("Bible Books & Utilities", () => {
  it("contains all 66 books of the Bible", () => {
    assert.strictEqual(BIBLE_BOOKS.length, 66);
    const ot = BIBLE_BOOKS.filter((b) => b.testament === "OT");
    const nt = BIBLE_BOOKS.filter((b) => b.testament === "NT");
    assert.strictEqual(ot.length, 39);
    assert.strictEqual(nt.length, 27);
  });

  it("retrieves books by case-insensitive 3-letter ID", () => {
    const gen = getBookById("gen");
    assert(gen);
    assert.strictEqual(gen.name, "Genesis");
    assert.strictEqual(gen.numChapters, 50);

    const rev = getBookById("REV");
    assert(rev);
    assert.strictEqual(rev.name, "Revelation");
    assert.strictEqual(rev.numChapters, 22);
  });

  it("generates correct chapter lists for single- and multi-chapter books", () => {
    const obadiahChapters = getBookChapters("OBA");
    assert.deepStrictEqual(obadiahChapters, [1]);

    const psalmChapters = getBookChapters("PSA");
    assert.strictEqual(psalmChapters.length, 150);
    assert.strictEqual(psalmChapters[0], 1);
    assert.strictEqual(psalmChapters[149], 150);
  });

  it("formats document titles accurately", () => {
    // Full book
    assert.strictEqual(getDocTitle("JHN", 1, 21, "ESV"), "John (ESV)");
    // Single chapter
    assert.strictEqual(getDocTitle("JHN", 1, 1, "ESV"), "John 1 (ESV)");
    // Chapter range
    assert.strictEqual(getDocTitle("ROM", 1, 8, "ESV"), "Romans 1-8 (ESV)");
  });

  it("validates ESV passage ranges per Crossway policy", () => {
    // Single and 2-chapter books are exempt
    const obaCheck = validateEsvPassageRange("OBA", 1, 1);
    assert.strictEqual(obaCheck.allowed, true);

    const hagCheck = validateEsvPassageRange("HAG", 1, 2);
    assert.strictEqual(hagCheck.allowed, true);

    // Half of Romans (8 chapters out of 16) is allowed
    const romHalfCheck = validateEsvPassageRange("ROM", 1, 8);
    assert.strictEqual(romHalfCheck.allowed, true);

    // Full Romans (16 chapters) exceeds the half-book limit
    const romFullCheck = validateEsvPassageRange("ROM", 1, 16);
    assert.strictEqual(romFullCheck.allowed, false);
    assert(romFullCheck.reason?.includes("Crossway ESV policy limits"));

    // Luke 1–12 has 625 verses (even though 12 chapters is 50% of 24, 625 > 500 verses)
    const lukeHalfCheck = validateEsvPassageRange("LUK", 1, 12);
    assert.strictEqual(lukeHalfCheck.allowed, false);
    assert.strictEqual(lukeHalfCheck.verseCount, 625);
    assert(lukeHalfCheck.reason?.includes("625 verses"));
    assert(lukeHalfCheck.reason?.includes("select up to chapters 1–9"));

    // Luke 1–9 has 470 verses (<= 500 verses and <= 12 chapters)
    const luke9Check = validateEsvPassageRange("LUK", 1, 9);
    assert.strictEqual(luke9Check.allowed, true);
    assert.strictEqual(luke9Check.verseCount, 470);
  });
});
