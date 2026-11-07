import { describe, it } from "node:test";
import assert from "node:assert";
import {
  BIBLE_BOOKS,
  DEFAULT_FORMAT_OPTIONS,
  applyOptionsToChapter,
  getBookById,
  getBookChapters,
  getChapterHeaderText,
  getChapterVerseCount,
  getDocTitle,
  getPassageTitle,
  getVersionName,
  isPartialVerseSelection,
  validateEsvPassageRange,
} from "./books";
import { parseEsvHtml } from "./providers/esv";

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

  it("returns accurate verse counts including translation-specific overrides", () => {
    assert.strictEqual(getChapterVerseCount("PSA", 119, "ESV"), 176);
    assert.strictEqual(getChapterVerseCount("JHN", 3, "ESV"), 36);
    assert.strictEqual(getChapterVerseCount("PHM", 1, "ESV"), 25);

    // 3 John has 14 verses in ESV/NET and 15 in CSB/NASB/NIV
    assert.strictEqual(getChapterVerseCount("3JN", 1, "ESV"), 14);
    assert.strictEqual(getChapterVerseCount("3JN", 1, "NET"), 14);
    assert.strictEqual(getChapterVerseCount("3JN", 1, "CSB"), 15);
    assert.strictEqual(getChapterVerseCount("3JN", 1, "NIV"), 15);
    assert.strictEqual(getChapterVerseCount("3JN", 1, "NASB"), 15);
  });

  it("formats document titles and passage titles accurately (full & partial verses)", () => {
    // Full chapter / book passage titles (without version parentheses)
    assert.strictEqual(getPassageTitle("JHN", 1, 21), "John");
    assert.strictEqual(getPassageTitle("JHN", 1, 1), "John 1");
    assert.strictEqual(getPassageTitle("ROM", 1, 8), "Romans 1-8");

    // Partial verse passage titles
    assert.strictEqual(
      getPassageTitle("PSA", 119, 119, 65, 72, "ESV"),
      "Psalms 119:65-72"
    );
    assert.strictEqual(
      getPassageTitle("JHN", 3, 3, 16, 16, "ESV"),
      "John 3:16"
    );
    assert.strictEqual(
      getPassageTitle("LUK", 9, 10, 57, 24, "ESV"),
      "Luke 9:57-10:24"
    );
    // Single-chapter book partial verses omit chapter 1 prefix
    assert.strictEqual(
      getPassageTitle("PHM", 1, 1, 4, 7, "ESV"),
      "Philemon 4-7"
    );
    assert.strictEqual(
      getPassageTitle("PHM", 1, 1, 6, 6, "ESV"),
      "Philemon 6"
    );
    // Single-chapter book full verses return just the book name
    assert.strictEqual(
      getPassageTitle("PHM", 1, 1, 1, 25, "ESV"),
      "Philemon"
    );

    // Full doc titles (with version parentheses)
    assert.strictEqual(getDocTitle("JHN", 1, 21, "ESV"), "John (ESV)");
    assert.strictEqual(getDocTitle("JHN", 1, 1, "ESV"), "John 1 (ESV)");
    assert.strictEqual(getDocTitle("ROM", 1, 8, "ESV"), "Romans 1-8 (ESV)");
    assert.strictEqual(
      getDocTitle("PSA", 119, 119, "ESV", 65, 72),
      "Psalms 119:65-72 (ESV)"
    );
    assert.strictEqual(
      getDocTitle("PHM", 1, 1, "ESV", 4, 7),
      "Philemon 4-7 (ESV)"
    );

    // Version names
    assert.strictEqual(getVersionName("ESV"), "English Standard Version");
    assert.strictEqual(getVersionName("CSB"), "Christian Standard Bible");
    assert.strictEqual(getVersionName("NIV"), "New International Version");
    assert.strictEqual(getVersionName("NASB"), "New American Standard Bible");
    assert.strictEqual(getVersionName("NET"), "New English Translation");
  });

  it("detects partial verse selection and formats chapter headers accurately", () => {
    assert.strictEqual(isPartialVerseSelection("JHN", 1, 3, 1, 36, "ESV"), false);
    assert.strictEqual(isPartialVerseSelection("JHN", 1, 3, 2, 1, "ESV"), true);

    // For John 1:2-3:1:
    // Chapter 1 -> "John 1:2-51"
    // Chapter 2 (all 25 verses) -> "John 2"
    // Chapter 3 (only verse 1) -> "John 3:1"
    assert.strictEqual(getChapterHeaderText("JHN", 1, 2, 51, "ESV"), "John 1:2-51");
    assert.strictEqual(getChapterHeaderText("JHN", 2, 1, 25, "ESV"), "John 2");
    assert.strictEqual(getChapterHeaderText("JHN", 3, 1, 1, "ESV"), "John 3:1");
    assert.strictEqual(getChapterHeaderText("PHM", 1, 4, 7, "ESV"), "Philemon 4-7");
  });

  it("slices verses in applyOptionsToChapter including Psalm superscriptions and acrostic headers", () => {
    // 1. Psalm 23 with canonical superscription ("A Psalm of David.")
    const psalm23Html = `
      <h4 class="psalm-title">A Psalm of David.</h4>
      <p class="block-indent">
        <span class="line"><b class="chapter-num" id="v19023001-1">23:1&nbsp;</b>The <span class="small-caps">Lord</span> is my shepherd; I shall not want.</span><br />
        <span class="line">&nbsp;&nbsp;<b class="verse-num" id="v19023002-1">2&nbsp;</b>&nbsp;&nbsp;He makes me lie down in green pastures.</span>
      </p>
    `;
    const parsedPsalm23 = parseEsvHtml(psalm23Html, "PSA", 23, {
      ...DEFAULT_FORMAT_OPTIONS,
      chapterHeaders: true,
      sectionHeadings: true,
      verseNumbers: true,
    });

    // When starting at verse 1, "A Psalm of David." superscription is included
    const slicedFromV1 = applyOptionsToChapter(
      parsedPsalm23,
      { ...DEFAULT_FORMAT_OPTIONS, chapterHeaders: true },
      { verseStart: 1, verseEnd: 1 }
    );
    const v1Texts = slicedFromV1.paragraphs.map((p) =>
      p.runs.map((r) => r.text).join("")
    );
    assert(v1Texts.some((t) => t.includes("Psalms 23:1")));
    assert(v1Texts.some((t) => t.includes("A Psalm of David.")));
    assert(v1Texts.some((t) => t.includes("is my shepherd")));
    assert(!v1Texts.some((t) => t.includes("green pastures")));

    // When starting at verse 2, "A Psalm of David." superscription is omitted
    const slicedFromV2 = applyOptionsToChapter(
      parsedPsalm23,
      { ...DEFAULT_FORMAT_OPTIONS, chapterHeaders: true },
      { verseStart: 2, verseEnd: 2 }
    );
    const v2Texts = slicedFromV2.paragraphs.map((p) =>
      p.runs.map((r) => r.text).join("")
    );
    assert(!v2Texts.some((t) => t.includes("A Psalm of David.")));
    assert(v2Texts.some((t) => t.includes("green pastures")));

    // 2. Psalm 119:65-72 with acrostic headings ("Teth" before v. 65, "Yodh" before v. 73)
    const psalm119Html = `
      <h3 class="psalm-acrostic-title" id="p19119057_01-1">Heth</h3>
      <p class="block-indent">
        <span class="line"><b class="verse-num" id="v19119064-1">64&nbsp;</b>The earth, O <span class="small-caps">Lord</span>, is full of your steadfast love;</span>
      </p>
      <h3 class="psalm-acrostic-title" id="p19119065_01-1">Teth</h3>
      <p class="block-indent">
        <span class="line"><b class="verse-num" id="v19119065-1">65&nbsp;</b>You have dealt well with your servant, O <span class="small-caps">Lord</span>,</span><br />
        <span class="line"><b class="verse-num" id="v19119072-1">72&nbsp;</b>The law of your mouth is better to me than thousands of gold and silver pieces.</span>
      </p>
      <h3 class="psalm-acrostic-title" id="p19119073_01-1">Yodh</h3>
      <p class="block-indent">
        <span class="line"><b class="verse-num" id="v19119073-1">73&nbsp;</b>Your hands have made and fashioned me;</span>
      </p>
    `;
    const parsedPsalm119 = parseEsvHtml(psalm119Html, "PSA", 119, {
      ...DEFAULT_FORMAT_OPTIONS,
      chapterHeaders: true,
      sectionHeadings: true,
      verseNumbers: true,
    });

    const slicedTeth = applyOptionsToChapter(
      parsedPsalm119,
      { ...DEFAULT_FORMAT_OPTIONS, chapterHeaders: true, sectionHeadings: false },
      { verseStart: 65, verseEnd: 72 }
    );
    const tethTexts = slicedTeth.paragraphs.map((p) =>
      p.runs.map((r) => r.text).join("")
    );
    assert(tethTexts.some((t) => t.includes("Psalms 119:65-72")));
    assert(tethTexts.some((t) => t === "Teth"), "Teth header should be included before v. 65 even when sectionHeadings is false");
    assert(!tethTexts.some((t) => t === "Heth"), "Heth header before v. 64 should be excluded");
    assert(!tethTexts.some((t) => t === "Yodh"), "Yodh header before v. 73 should be excluded");

    // 3. When chapterHeaders is false on a partial chapter starting at verse 65, first verse superscript is "119:65\u00A0"
    const noHeadersTeth = applyOptionsToChapter(
      parsedPsalm119,
      { ...DEFAULT_FORMAT_OPTIONS, chapterHeaders: false, verseNumbers: true },
      { verseStart: 65, verseEnd: 72 }
    );
    const firstVerseSuperscript = noHeadersTeth.paragraphs
      .flatMap((p) => p.runs)
      .find((r) => r.superscript);
    assert(firstVerseSuperscript);
    assert.strictEqual(firstVerseSuperscript.text, "119:65\u00A0");
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

    // Partial verse range in Luke 9:57-10:24 (6 + 24 = 30 verses) is allowed
    const lukePartialCheck = validateEsvPassageRange("LUK", 9, 10, 57, 24);
    assert.strictEqual(lukePartialCheck.allowed, true);
    assert.strictEqual(lukePartialCheck.verseCount, 30);
  });
});
