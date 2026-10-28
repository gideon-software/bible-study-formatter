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

  it("extracts chapter heading and omits section heading by default (sectionHeadings: false)", () => {
    const parsed = parseApiBibleHtml(sampleApiBibleHtml, "JHN", 1, defaultOptions);
    assert.strictEqual(parsed.bookName, "John");
    assert.strictEqual(parsed.chapterNum, 1);

    // Should have John 1 chapter heading
    const firstP = parsed.paragraphs[0];
    assert.strictEqual(firstP.type, "heading");
    assert.strictEqual(firstP.runs[0].text, "John 1");

    // Second paragraph should be prose, not the section heading
    const secondP = parsed.paragraphs[1];
    assert.strictEqual(secondP.type, "paragraph");
  });

  it("extracts section heading when sectionHeadings is true", () => {
    const parsed = parseApiBibleHtml(sampleApiBibleHtml, "JHN", 1, {
      ...defaultOptions,
      sectionHeadings: true,
    });

    const secondP = parsed.paragraphs[1];
    assert.strictEqual(secondP.type, "heading");
    assert.strictEqual(secondP.isSectionHeading, true);
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

  it("cleans CSB #—# em-dash markers and orphaned nbsp spaces before closing punctuation and words", () => {
    const rawCsbRom1 = `<p class="m"><span data-number="1" data-sid="ROM 1:1" class="v">1</span>Paul, a servant of Christ Jesus, called as an apostle\u00A0 and set apart\u00A0 for the gospel of God\u00A0\u00A0#—\u00A0# <span data-number="2" data-sid="ROM 1:2" class="v">2</span>which he promised beforehand\u00A0 through his prophets\u00A0 in the Holy Scriptures\u00A0#—\u00A0# <span data-number="3" data-sid="ROM 1:3" class="v">3</span>concerning his Son.</p><p class="m"><span data-number="9" data-sid="ROM 1:9" class="v">9</span>God is my witness,\u00A0 whom I serve with my spirit\u00A0 in telling the good news about his Son\u00A0#—\u00A0#that I constantly mention you.</p><p class="p"><span data-number="13" data-sid="ROM 1:13" class="v">13</span>Now I don’t want you to be unaware,\u00A0 brothers and sisters, that I often planned to come to you (but was prevented until now\u00A0) in order that I might have a fruitful ministry\u00A0 among you.</p>`;

    const parsed = parseApiBibleHtml(rawCsbRom1, "ROM", 1, defaultOptions);
    const proseParagraphs = parsed.paragraphs.filter((p) => p.type === "paragraph");
    assert.strictEqual(proseParagraphs.length, 3);

    const p1Text = proseParagraphs[0].runs.map((r) => r.text).join("");
    const p2Text = proseParagraphs[1].runs.map((r) => r.text).join("");
    const p3Text = proseParagraphs[2].runs.map((r) => r.text).join("");

    // Must not contain any # characters or double spaces
    assert.strictEqual(p1Text.includes("#"), false);
    assert.strictEqual(p2Text.includes("#"), false);
    assert.strictEqual(p1Text.includes("  "), false);
    assert.strictEqual(p2Text.includes("  "), false);
    assert.strictEqual(p3Text.includes("  "), false);

    // Mid-verse em-dash in v9 should be clean without spaces or pound signs
    assert(p2Text.includes("about his Son—that I constantly mention you."));

    // Closing parenthesis in v13 should not have a preceding space
    assert(p3Text.includes("(but was prevented until now)"));
  });
});
