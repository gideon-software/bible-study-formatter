import { describe, it } from "node:test";
import assert from "node:assert";
import {
  matchBookId,
  parseUrlSettings,
  parseBoolParam,
  buildShareableUrl,
} from "./urlParams";

describe("URL Parameters Parser", () => {
  it("matches books by 3-letter code or full name", () => {
    assert.strictEqual(matchBookId("ROM"), "ROM");
    assert.strictEqual(matchBookId("rom"), "ROM");
    assert.strictEqual(matchBookId("Romans"), "ROM");
    assert.strictEqual(matchBookId("1 Corinthians"), "1CO");
    assert.strictEqual(matchBookId("1corinthians"), "1CO");
    assert.strictEqual(matchBookId("Genesis"), "GEN");
    assert.strictEqual(matchBookId("NonExistentBook"), null);
  });

  it("parses boolean parameters correctly", () => {
    assert.strictEqual(parseBoolParam("1"), true);
    assert.strictEqual(parseBoolParam("true"), true);
    assert.strictEqual(parseBoolParam("yes"), true);
    assert.strictEqual(parseBoolParam("0"), false);
    assert.strictEqual(parseBoolParam("false"), false);
    assert.strictEqual(parseBoolParam(null), undefined);
    assert.strictEqual(parseBoolParam("invalid"), undefined);
  });

  it("parses empty search string safely", () => {
    const parsed = parseUrlSettings("");
    assert.strictEqual(parsed.hasUrlSettings, false);
    assert.strictEqual(parsed.versionId, undefined);
    assert.strictEqual(parsed.bookId, undefined);
  });

  it("parses full URL search string with Bible passage & options", () => {
    const search = "?v=CSB&book=Romans&start=12&end=14&font=georgia&size=14&spacing=1.5&breaks=0&verses=1";
    const parsed = parseUrlSettings(search);

    assert.strictEqual(parsed.hasUrlSettings, true);
    assert.strictEqual(parsed.versionId, "CSB");
    assert.strictEqual(parsed.bookId, "ROM");
    assert.strictEqual(parsed.chapterStart, 12);
    assert.strictEqual(parsed.chapterEnd, 14);
    assert.strictEqual(parsed.options?.fontName, "Georgia");
    assert.strictEqual(parsed.options?.fontSize, 14);
    assert.strictEqual(parsed.options?.lineSpacing, 1.5);
    assert.strictEqual(parsed.options?.chapterPageBreaks, false);
    assert.strictEqual(parsed.options?.verseNumbers, true);
  });

  it("defaults chapterEnd to chapterStart when only start or ch is specified", () => {
    const parsed = parseUrlSettings("?b=GEN&ch=3");
    assert.strictEqual(parsed.bookId, "GEN");
    assert.strictEqual(parsed.chapterStart, 3);
    assert.strictEqual(parsed.chapterEnd, 3);
  });

  it("handles NET and ESV versions and clamping to book chapter limits", () => {
    const parsed = parseUrlSettings("?v=net&book=JUDE&start=1&end=50");
    assert.strictEqual(parsed.versionId, "NET");
    assert.strictEqual(parsed.bookId, "JUD");
    assert.strictEqual(parsed.chapterStart, 1);
    assert.strictEqual(parsed.chapterEnd, 1); // Jude has only 1 chapter
  });

  it("builds a shareable URL that round-trips through parseUrlSettings", () => {
    const url = buildShareableUrl({
      baseUrl: "https://bsf.example.com/",
      versionId: "CSB",
      bookId: "ROM",
      chapterStart: 1,
      chapterEnd: 2,
      options: {
        chapterHeaders: true,
        chapterPageBreaks: false,
        verseNumbers: true,
        sectionHeadings: true,
        titlePage: false,
        fontName: "Georgia",
        fontSize: 12,
        lineSpacing: 1.5,
      },
    });

    const parsed = parseUrlSettings(new URL(url).search);
    assert.strictEqual(parsed.versionId, "CSB");
    assert.strictEqual(parsed.bookId, "ROM");
    assert.strictEqual(parsed.chapterStart, 1);
    assert.strictEqual(parsed.chapterEnd, 2);
    assert.strictEqual(parsed.options?.chapterHeaders, true);
    assert.strictEqual(parsed.options?.chapterPageBreaks, false);
    assert.strictEqual(parsed.options?.verseNumbers, true);
    assert.strictEqual(parsed.options?.sectionHeadings, true);
    assert.strictEqual(parsed.options?.titlePage, false);
    assert.strictEqual(parsed.options?.fontName, "Georgia");
    assert.strictEqual(parsed.options?.fontSize, 12);
    assert.strictEqual(parsed.options?.lineSpacing, 1.5);
  });
});
