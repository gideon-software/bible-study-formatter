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

  it("extracts chapter heading and omits section heading by default (sectionHeadings: false)", () => {
    const parsed = parseEsvHtml(sampleEsvHtml, "JHN", 1, defaultOptions);
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
    const parsed = parseEsvHtml(sampleEsvHtml, "JHN", 1, {
      ...defaultOptions,
      sectionHeadings: true,
    });

    const secondP = parsed.paragraphs[1];
    assert.strictEqual(secondP.type, "heading");
    assert.strictEqual(secondP.isSectionHeading, true);
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

    const parsed = parseEsvHtml(rawApiHtml, "ROM", 1, {
      ...defaultOptions,
      sectionHeadings: true,
    });
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

  it("parses Crossway ESV API v3 block-indent poetry (Romans 3:10-12) and strips embedded nbsp padding after verse numbers", () => {
    const romans3PoetryHtml = `
      <p class="block-indent"><span class="begin-line-group"></span>
      <span id="p45003010_08-1" class="line">&nbsp;&nbsp;“None is righteous, no, not one;</span><br /><span id="p45003010_08-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;no, not one;</span><br /><span id="p45003011_08-1" class="indent line"><b class="verse-num inline" id="v45003011-1">11&nbsp;</b>&nbsp;&nbsp;&nbsp;&nbsp;no one understands;</span><br /><span id="p45003011_08-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;no one seeks for God.</span><br /><span id="p45003012_08-1" class="line"><b class="verse-num inline" id="v45003012-1">12&nbsp;</b>&nbsp;&nbsp;All have turned aside; together they have become worthless;</span><br /><span id="p45003012_08-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;no one does good,</span><br /><span id="p45003012_08-1" class="indent line">&nbsp;&nbsp;&nbsp;&nbsp;not even one.”</span><br /><span class="end-line-group"></span>
      </p>
    `;

    const parsed = parseEsvHtml(romans3PoetryHtml, "ROM", 3, defaultOptions);
    const poetryPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert.strictEqual(poetryPs.length, 7);

    // Line 1: 4 spaces indent, no leading nbsp in text run
    assert.strictEqual(poetryPs[0].indentSpaces, 4);
    assert.strictEqual(poetryPs[0].runs[0].text, "“None is righteous, no, not one;");

    // Line 2: 8 spaces indent, no leading nbsp in text run
    assert.strictEqual(poetryPs[1].indentSpaces, 8);
    assert.strictEqual(poetryPs[1].runs[0].text, "no, not one;");

    // Line 3 (Verse 11): 8 spaces indent, superscript "11\u00A0", followed immediately by "no one understands;"
    assert.strictEqual(poetryPs[2].indentSpaces, 8);
    assert.strictEqual(poetryPs[2].runs[0].text, "11\u00A0");
    assert.strictEqual(poetryPs[2].runs[0].superscript, true);
    assert.strictEqual(poetryPs[2].runs[1].text, "no one understands;");

    // Line 5 (Verse 12): 4 spaces indent, superscript "12\u00A0", followed immediately by "All have turned aside..."
    assert.strictEqual(poetryPs[4].indentSpaces, 4);
    assert.strictEqual(poetryPs[4].runs[0].text, "12\u00A0");
    assert.strictEqual(poetryPs[4].runs[0].superscript, true);
    assert.strictEqual(
      poetryPs[4].runs[1].text,
      "All have turned aside; together they have become worthless;"
    );
  });

  it("preserves canonical psalm-title in italics even when sectionHeadings is false and uppercases divine-name", () => {
    const psalm23Html = `
      <h3 class="extra_space">The <span class="divine-name">Lord</span> Is My Shepherd</h3>
      <p class="block-indent"><span class="begin-line-group"></span>
      <h4 id="p19023001_05-1" class="psalm-title">A Psalm of David.</h4>
      <span id="p19023001_05-1" class="line"><b class="chapter-num" id="v19023001-1">23:1&nbsp;</b>&nbsp;&nbsp;The <span class="divine-name">Lord</span> is my shepherd;</span><br /><span class="end-line-group"></span>
      </p>
    `;

    const parsed = parseEsvHtml(psalm23Html, "PSA", 23, defaultOptions);
    // 1. "Psalms 23", 2. "A Psalm of David." (italic paragraph), 3. poetry line
    assert.strictEqual(parsed.paragraphs.length, 3);
    assert.strictEqual(parsed.paragraphs[1].type, "paragraph");
    assert.strictEqual(parsed.paragraphs[1].runs[0].text, "A Psalm of David.");
    assert.strictEqual(parsed.paragraphs[1].runs[0].italic, true);

    assert.strictEqual(parsed.paragraphs[2].type, "poetry");
    const fullLineText = parsed.paragraphs[2].runs.map((r) => r.text).join("");
    assert.strictEqual(fullLineText, "1\u00A0The LORD is my shepherd;");
  });
});
