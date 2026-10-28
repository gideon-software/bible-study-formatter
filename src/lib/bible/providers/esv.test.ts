import { describe, it } from "node:test";
import assert from "node:assert";
import { parseEsvHtml } from "./esv";
import { FormatOptions } from "../books";

describe("Crossway ESV HTML Parser", () => {
  const sampleEsvHtml = `
  <div class="esv">
    <h3 class="extra_space">The Word Became Flesh</h3>
    <p class="paragraph">
      <span class="verse-num">1&nbsp;</span>In the beginning was the Word, and the Word was with God, and the Word was God.
      <span class="verse-num">2&nbsp;</span>He was in the beginning with God.
    </p>
    <p class="line-group">
      <span class="line"><span class="verse-num">5&nbsp;</span>The light shines in the darkness,</span>
      <span class="indent">and the darkness has not overcome it.</span>
    </p>
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
    const parsed = parseEsvHtml(sampleEsvHtml, "JHN", 1, defaultOptions);
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
    const parsed = parseEsvHtml(sampleEsvHtml, "JHN", 1, defaultOptions);
    const proseP = parsed.paragraphs.find((p) => p.type === "paragraph");
    assert(proseP, "Should find paragraph");

    const verse1Run = proseP.runs.find((r) => r.text.includes("1"));
    assert(verse1Run, "Should find verse 1 run");
    assert.strictEqual(verse1Run.superscript, true);
  });

  it("correctly identifies poetry line groups and indentations", () => {
    const parsed = parseEsvHtml(sampleEsvHtml, "JHN", 1, defaultOptions);
    const poetryPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert.strictEqual(poetryPs.length, 2);

    // Line 1 should have 4 space indent
    assert.strictEqual(poetryPs[0].indentSpaces, 4);
    // Indented line should have 8 space indent
    assert.strictEqual(poetryPs[1].indentSpaces, 8);
    assert(poetryPs[1].runs[0].text.includes("darkness has not overcome it"));
  });

  it("suppresses verse numbers when verseNumbers is false", () => {
    const parsed = parseEsvHtml(sampleEsvHtml, "JHN", 1, {
      ...defaultOptions,
      verseNumbers: false,
    });
    const proseP = parsed.paragraphs.find((p) => p.type === "paragraph");
    assert(proseP);
    const hasVerseNum = proseP.runs.some((r) => r.superscript);
    assert.strictEqual(hasVerseNum, false);
  });

  it("correctly parses raw root-level ESV API HTML with chapter-num tag", () => {
    const rawApiHtml = `
      <h3>Greeting</h3>
      <p class="starts-chapter"><b class="chapter-num">1:1&nbsp;</b>Paul, a servant of Christ Jesus, <b class="verse-num">2&nbsp;</b>which he promised beforehand.</p>
    `;

    const parsed = parseEsvHtml(rawApiHtml, "ROM", 1, defaultOptions);
    assert.strictEqual(parsed.paragraphs.length, 3); // 1. "Romans 1", 2. "Greeting", 3. verse text

    const verseP = parsed.paragraphs[2];
    assert.strictEqual(verseP.type, "paragraph");
    // Verse 1 should be parsed with superscript "1" (since chapterHeaders is true)
    const verse1 = verseP.runs.find((r) => r.superscript && r.text.includes("1"));
    assert(verse1, "Should extract verse 1 from chapter-num");
    assert.strictEqual(verse1.text.trim(), "1");

    // Verse 2
    const verse2 = verseP.runs.find((r) => r.superscript && r.text.includes("2"));
    assert(verse2, "Should extract verse 2");
    assert(verseP.runs.some((r) => r.text.includes("Paul, a servant")));
  });
});
