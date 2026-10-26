import { describe, it } from "node:test";
import assert from "node:assert";
import { parseApiBibleHtml } from "./apibible";
import { FormatOptions } from "../books";

describe("API.Bible HTML Parser (CSB, NIV, NASB)", () => {
  const sampleApiBibleHtml = `
  <div class="scripture-styles">
    <p class="s1">The Word Became Flesh</p>
    <p class="p">
      <span class="v" data-number="1">1</span>In the beginning was the Word, and the Word was with God, and the Word was God.
      <span class="v" data-number="2">2</span>He was in the beginning with God.
    </p>
    <p class="q1">
      <span class="v" data-number="5">5</span>The light shines in the darkness,
    </p>
    <p class="q2">and the darkness has not overcome it.</p>
  </div>
  `;

  const defaultOptions: FormatOptions = {
    chapterHeaders: true,
    chapterPageBreaks: true,
    verseNumbers: true,
    titlePage: false,
    fontName: "Arial",
    fontSize: 11,
    lineSpacing: 2,
  };

  it("extracts chapter heading and section heading when chapterHeaders is true", () => {
    const parsed = parseApiBibleHtml(sampleApiBibleHtml, "JHN", 1, defaultOptions);
    assert.strictEqual(parsed.bookName, "John");
    assert.strictEqual(parsed.chapterNum, 1);

    // Should have John 1 chapter heading
    const firstP = parsed.paragraphs[0];
    assert.strictEqual(firstP.type, "heading");
    assert.strictEqual(firstP.runs[0].text, "John 1");

    // Should have "The Word Became Flesh" section heading
    const secondP = parsed.paragraphs[1];
    assert.strictEqual(secondP.type, "heading");
    assert.strictEqual(secondP.runs[0].text, "The Word Became Flesh");
  });

  it("extracts verse numbers with superscript when verseNumbers is true", () => {
    const parsed = parseApiBibleHtml(sampleApiBibleHtml, "JHN", 1, defaultOptions);
    const proseP = parsed.paragraphs.find((p) => p.type === "paragraph");
    assert(proseP, "Should find paragraph");

    const verse1Run = proseP.runs.find((r) => r.text.includes("1"));
    assert(verse1Run, "Should find verse 1 run");
    assert.strictEqual(verse1Run.superscript, true);
  });

  it("correctly identifies poetry line groups and indentations", () => {
    const parsed = parseApiBibleHtml(sampleApiBibleHtml, "JHN", 1, defaultOptions);
    const poetryPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert.strictEqual(poetryPs.length, 2);

    // q1 should have 4 space indent
    assert.strictEqual(poetryPs[0].indentSpaces, 4);
    // q2 should have 8 space indent
    assert.strictEqual(poetryPs[1].indentSpaces, 8);
    assert(poetryPs[1].runs[0].text.includes("darkness has not overcome it"));
  });

  it("suppresses verse numbers when verseNumbers is false", () => {
    const parsed = parseApiBibleHtml(sampleApiBibleHtml, "JHN", 1, {
      ...defaultOptions,
      verseNumbers: false,
    });
    const proseP = parsed.paragraphs.find((p) => p.type === "paragraph");
    assert(proseP);
    const hasVerseNum = proseP.runs.some((r) => r.superscript);
    assert.strictEqual(hasVerseNum, false);
  });
});
