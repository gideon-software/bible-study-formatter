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

  it("indents CSB NT poetic quotations (.qc with data-vid continuations) with 4/8 spaces and renders .qt in plain text", () => {
    const rawCsbRom3 = `
      <p class="m"><span data-number="9" data-sid="ROM 3:9" class="v">9</span>What then? <span data-number="10" data-sid="ROM 3:10" class="v">10</span>as it is written:</p>
      <p data-vid="ROM 3:10" class="qc"><span class="qt">There is no one righteous, not even one.</span></p>
      <p class="qc"><span data-number="11" data-sid="ROM 3:11" class="v">11</span><span class="qt">There is no one who understands;</span></p>
      <p data-vid="ROM 3:11" class="qc"><span class="qt">there is no one who seeks God.</span></p>
      <p class="qc"><span data-number="12" data-sid="ROM 3:12" class="v">12</span><span class="qt">All have turned away;</span></p>
      <p data-vid="ROM 3:12" class="qc"><span class="qt">all alike have become worthless.</span></p>
    `;

    const parsed = parseApiBibleHtml(rawCsbRom3, "ROM", 3, defaultOptions);
    const poetryPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert.strictEqual(poetryPs.length, 5);

    // First line of quote after prose (v10) -> 4 spaces, plain text (not italic)
    assert.strictEqual(poetryPs[0].indentSpaces, 4);
    assert.strictEqual(poetryPs[0].runs[0].italic, undefined);

    // First line of v11 -> 4 spaces, starts with superscript "11\u00A0"
    assert.strictEqual(poetryPs[1].indentSpaces, 4);
    assert.strictEqual(poetryPs[1].runs[0].superscript, true);
    assert.strictEqual(poetryPs[1].runs[1].italic, undefined);

    // Second line of v11 (data-vid="ROM 3:11") -> 8 spaces
    assert.strictEqual(poetryPs[2].indentSpaces, 8);
    assert.strictEqual(poetryPs[2].runs[0].text, "there is no one who seeks God.");

    // First line of v12 -> 4 spaces; second line of v12 -> 8 spaces
    assert.strictEqual(poetryPs[3].indentSpaces, 4);
    assert.strictEqual(poetryPs[4].indentSpaces, 8);
  });

  it("indents CSB OT Psalms (.q1 primary and .q continuation with data-vid) with 4/8 spaces", () => {
    const rawCsbPsa23 = `
      <p class="d">A psalm of David.</p>
      <p class="q1"><span data-number="1" data-sid="PSA 23:1" class="v">1</span>The <span class="nd">Lord</span> is my shepherd;</p>
      <p data-vid="PSA 23:1" class="q">I have what I need.</p>
    `;

    const parsed = parseApiBibleHtml(rawCsbPsa23, "PSA", 23, defaultOptions);
    // 1. "Psalms 23", 2. "A psalm of David." (italic), 3. q1 (4 spaces), 4. q (8 spaces)
    assert.strictEqual(parsed.paragraphs.length, 4);
    assert.strictEqual(parsed.paragraphs[1].type, "paragraph");
    assert.strictEqual(parsed.paragraphs[1].runs[0].italic, true);

    assert.strictEqual(parsed.paragraphs[2].type, "poetry");
    assert.strictEqual(parsed.paragraphs[2].indentSpaces, 4);
    assert.strictEqual(
      parsed.paragraphs[2].runs.map((r) => r.text).join(""),
      "1\u00A0The LORD is my shepherd;"
    );

    assert.strictEqual(parsed.paragraphs[3].type, "poetry");
    assert.strictEqual(parsed.paragraphs[3].indentSpaces, 8);
  });

  it("indents USFM list items (.li1 in CSB Daniel 5:26-28) by 4 spaces", () => {
    const rawCsbDan5 = `
      <p class="m"><span data-number="25" data-sid="DAN 5:25" class="v">25</span>“This is the writing that was inscribed: M<span class="sc">ene</span>, M<span class="sc">ene</span>, T<span class="sc">ekel</span>, and P<span class="sc">arsin</span>. <span data-number="26" data-sid="DAN 5:26" class="v">26</span>This is the interpretation of the message:</p>
      <p data-vid="DAN 5:26" class="li1">‘Mene’\u00A0 means that God has numbered\u00A0 the days of your kingdom and brought it to an end.\u00A0</p>
      <p class="li1"><span data-number="27" data-sid="DAN 5:27" class="v">27</span>‘Tekel’\u00A0 means that you have been weighed\u00A0 on the balance and found deficient.</p>
      <p class="li1"><span data-number="28" data-sid="DAN 5:28" class="v">28</span>‘Peres’\u00A0 means that your kingdom has been divided and given to the Medes and Persians.”\u00A0</p>
    `;

    const parsed = parseApiBibleHtml(rawCsbDan5, "DAN", 5, defaultOptions);
    const indentedPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert.strictEqual(indentedPs.length, 3);
    assert.strictEqual(indentedPs[0].indentSpaces, 4);
    assert.strictEqual(indentedPs[1].indentSpaces, 4);
    assert.strictEqual(indentedPs[2].indentSpaces, 4);
    assert(
      indentedPs[0].runs.map((r) => r.text).join("").startsWith("‘Mene’ means that God has numbered")
    );
  });
});
