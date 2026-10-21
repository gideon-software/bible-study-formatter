import { describe, it } from "node:test";
import assert from "node:assert";
import {
  BIBLE_BOOKS,
  getBookById,
  getBookChapters,
  getDocTitle,
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
});
