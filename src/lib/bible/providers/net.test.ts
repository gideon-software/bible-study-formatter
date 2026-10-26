import { describe, it } from "node:test";
import assert from "node:assert";
import { parseNetVerses, NetApiVerse } from "./net";
import { FormatOptions } from "../books";

describe("NET Bible Parser (labs.bible.org)", () => {
  const sampleNetVerses: NetApiVerse[] = [
    {
      bookname: "John",
      chapter: "1",
      verse: "1",
      text: '<p class="bodytext"><st data-num="1722">In</st> the <st data-num="746">beginning</st><n id="1" /> was the Word, and the Word was with God, and the Word was fully God.<n id="2" /> ',
    },
    {
      bookname: "John",
      chapter: "1",
      verse: "2",
      text: 'The Word was with God in the beginning. </p>',
    },
    {
      bookname: "John",
      chapter: "1",
      verse: "5",
      text: '<p class="poetry">The light shines in the darkness, </p><p class="poetry">and the darkness has not mastered it. </p>',
    },
  ];

  const defaultOptions: FormatOptions = {
    chapterHeaders: true,
    chapterPageBreaks: true,
    verseNumbers: true,
    titlePage: false,
    fontName: "Arial",
    fontSize: 11,
    lineSpacing: 2,
  };

  it("extracts chapter heading when chapterHeaders is true", () => {
    const parsed = parseNetVerses(sampleNetVerses, "JHN", 1, defaultOptions);
    assert.strictEqual(parsed.bookName, "John");
    assert.strictEqual(parsed.chapterNum, 1);

    const firstP = parsed.paragraphs[0];
    assert.strictEqual(firstP.type, "heading");
    assert.strictEqual(firstP.runs[0].text, "John 1");
  });

  it("extracts verse numbers with superscript and strips footnotes", () => {
    const parsed = parseNetVerses(sampleNetVerses, "JHN", 1, defaultOptions);
    const proseP = parsed.paragraphs.find((p) => p.type === "paragraph");
    assert(proseP, "Should find prose paragraph");

    const verse1Run = proseP.runs.find((r) => r.text.includes("1"));
    assert(verse1Run, "Should find verse 1 superscript");
    assert.strictEqual(verse1Run.superscript, true);

    // Footnote marker should be stripped
    const hasFootnote = proseP.runs.some((r) => r.text.includes("<n"));
    assert.strictEqual(hasFootnote, false);
  });

  it("extracts poetry lines with indentation", () => {
    const parsed = parseNetVerses(sampleNetVerses, "JHN", 1, defaultOptions);
    const poetryPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert(poetryPs.length >= 1, "Should find poetry paragraphs");
    assert.strictEqual(poetryPs[0].indentSpaces, 4);
    assert(poetryPs[0].runs.some((r) => r.text.includes("light shines")));
  });

  it("suppresses verse numbers when verseNumbers is false", () => {
    const parsed = parseNetVerses(sampleNetVerses, "JHN", 1, {
      ...defaultOptions,
      verseNumbers: false,
    });
    const proseP = parsed.paragraphs.find((p) => p.type === "paragraph");
    assert(proseP);
    const hasVerseNum = proseP.runs.some((r) => r.superscript);
    assert.strictEqual(hasVerseNum, false);
  });
});
