import { describe, it } from "node:test";
import assert from "node:assert";
import { buildGoogleDocsRequests, formatDriveTimestampSuffix } from "./docs";
import { FormatOptions, ParsedChapter } from "../bible/books";

describe("Google Docs Request Builder", () => {
  const sampleChapter: ParsedChapter = {
    bookId: "JHN",
    bookName: "John",
    chapterNum: 1,
    paragraphs: [
      {
        type: "heading",
        alignment: "center",
        runs: [{ text: "John 1", bold: true }],
      },
      {
        type: "paragraph",
        runs: [
          { text: "1\u00A0", superscript: true },
          { text: "In the beginning was the Word." },
        ],
      },
      {
        type: "poetry",
        indentSpaces: 4,
        runs: [{ text: "The light shines in the darkness." }],
      },
    ],
  };

  const options: FormatOptions = {
    chapterHeaders: true,
    chapterPageBreaks: true,
    verseNumbers: true,
    titlePage: true,
    fontName: "Arial",
    fontSize: 12,
    lineSpacing: 1.5,
  };

  it("builds margin styles, insertText, and typography batch requests", () => {
    const requests = buildGoogleDocsRequests([sampleChapter], options, "John (ESV)", "ESV");

    // Margin request
    const marginReq = requests.find((r) => r.updateDocumentStyle);
    assert(marginReq, "Must include updateDocumentStyle");
    assert.strictEqual(
      marginReq.updateDocumentStyle?.documentStyle?.marginTop?.magnitude,
      72
    );

    // InsertText request
    const insertReq = requests.find((r) => r.insertText);
    assert(insertReq, "Must include insertText");
    assert(insertReq.insertText?.text?.includes("John\n"));
    assert(!insertReq.insertText?.text?.includes("John (ESV)"));
    assert(insertReq.insertText?.text?.includes("ESV • English Standard Version"));
    assert(insertReq.insertText?.text?.includes("In the beginning was the Word."));

    // Font styling request
    const fontReq = requests.find(
      (r) =>
        r.updateTextStyle &&
        r.updateTextStyle.textStyle?.weightedFontFamily?.fontFamily === "Arial"
    );
    assert(fontReq, "Must include global font setting");
    assert.strictEqual(fontReq.updateTextStyle?.textStyle?.fontSize?.magnitude, 12);

    // Superscript styling request
    const superReq = requests.find(
      (r) =>
        r.updateTextStyle &&
        r.updateTextStyle.textStyle?.baselineOffset === "SUPERSCRIPT"
    );
    assert(superReq, "Must include superscript request for verse numbers");
  });

  it("emits insertPageBreak requests and keeps exact superscript indices across multiple chapters", () => {
    const chapter2: ParsedChapter = {
      bookId: "JHN",
      bookName: "John",
      chapterNum: 2,
      paragraphs: [
        {
          type: "heading",
          alignment: "center",
          runs: [{ text: "John 2", bold: true }],
        },
        {
          type: "paragraph",
          runs: [
            { text: "1\u00A0", superscript: true },
            { text: "On the third day there was a wedding at Cana in Galilee. " },
            { text: "2\u00A0", superscript: true },
            { text: "Jesus also was invited to the wedding with his disciples." },
          ],
        },
      ],
    };

    const requests = buildGoogleDocsRequests(
      [sampleChapter, chapter2],
      options,
      "John 1-2 (ESV)",
      "ESV"
    );

    const insertReq = requests.find((r) => r.insertText);
    const fullText = insertReq?.insertText?.text || "";

    // Must not contain raw form feed control character \u000C
    assert.strictEqual(fullText.includes("\u000C"), false);

    // Must emit 2 insertPageBreak requests (1 after title page, 1 before chapter 2) in reverse index order
    const pageBreaks = requests.filter((r) => r.insertPageBreak);
    assert.strictEqual(pageBreaks.length, 2);
    const firstPbIdx = pageBreaks[0].insertPageBreak?.location?.index ?? 0;
    const secondPbIdx = pageBreaks[1].insertPageBreak?.location?.index ?? 0;
    assert(
      firstPbIdx > secondPbIdx,
      "Page breaks must be emitted in descending index order"
    );

    // Every SUPERSCRIPT range must slice to the exact verse number run in fullText
    const superReqs = requests.filter(
      (r) =>
        r.updateTextStyle &&
        r.updateTextStyle.textStyle?.baselineOffset === "SUPERSCRIPT"
    );
    assert.strictEqual(superReqs.length, 3); // Ch1 v1, Ch2 v1, Ch2 v2

    const slicedSuperscripts = superReqs.map((r) => {
      const start = (r.updateTextStyle?.range?.startIndex ?? 1) - 1;
      const end = (r.updateTextStyle?.range?.endIndex ?? 1) - 1;
      // The character immediately following the superscript range should be a regular-font \u00A0
      assert.strictEqual(fullText[end], "\u00A0");
      return fullText.slice(start, end);
    });
    assert.deepStrictEqual(slicedSuperscripts, ["1", "1", "2"]);
  });

  it("formats Google Drive duplicate timestamp suffix as [Oct 29 @ 6:12am]", () => {
    const sampleDate = new Date("2026-10-29T10:12:00.000Z");
    const formatted = formatDriveTimestampSuffix(sampleDate, "America/New_York");
    assert.strictEqual(formatted, "[Oct 29 @ 6:12am]");
  });
});
