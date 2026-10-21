import { describe, it } from "node:test";
import assert from "node:assert";
import { buildGoogleDocsRequests } from "./docs";
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
    assert(insertReq.insertText?.text?.includes("John (ESV)"));
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
});
