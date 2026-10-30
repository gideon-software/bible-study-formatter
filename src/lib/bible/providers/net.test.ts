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

    // Footnote marker should be stripped without truncating text after <n id="1" />
    const fullProseText = proseP.runs.map((r) => r.text).join("");
    assert.strictEqual(fullProseText.includes("<n"), false);
    assert(
      fullProseText.includes("was the Word, and the Word was with God"),
      "Text after self-closing <n id=\"1\" /> must not be truncated"
    );
    assert(
      fullProseText.includes("The Word was with God in the beginning."),
      "Subsequent verses in the same paragraph must not be swallowed by <n id=\"1\" />"
    );
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

  it("strips bold and italic from NET OT quotations (.otpoetry) and indents continuation lines by 8 spaces", () => {
    const rom3NetVerses: NetApiVerse[] = [
      {
        bookname: "Romans",
        chapter: "3",
        verse: "10",
        text: 'just as it is written: <p class="otpoetry">“<i><b>There is no one righteous, not even one;</b></i></p>',
      },
      {
        bookname: "Romans",
        chapter: "3",
        verse: "11",
        text: '<p class="otpoetry"><i><b>there is no one who understands;</b></i><p class="otpoetry"><i><b>there is no one who seeks God</b></i>. </p>',
      },
    ];

    const parsed = parseNetVerses(rom3NetVerses, "ROM", 3, defaultOptions);
    const poetryPs = parsed.paragraphs.filter((p) => p.type === "poetry");
    assert.strictEqual(poetryPs.length, 3);

    // v10 line 1 -> 4 spaces, neither bold nor italic
    assert.strictEqual(poetryPs[0].indentSpaces, 4);
    assert.strictEqual(
      poetryPs[0].runs.some((r) => r.bold || r.italic),
      false
    );

    // v11 line 1 -> 4 spaces, starts with superscript "11\u00A0", plain text
    assert.strictEqual(poetryPs[1].indentSpaces, 4);
    assert.strictEqual(poetryPs[1].runs[0].text, "11\u00A0");
    assert.strictEqual(poetryPs[1].runs[0].superscript, true);
    assert.strictEqual(
      poetryPs[1].runs.some((r) => r.bold || r.italic),
      false
    );

    // v11 line 2 -> 8 spaces, plain text
    assert.strictEqual(poetryPs[2].indentSpaces, 8);
    assert.strictEqual(
      poetryPs[2].runs.map((r) => r.text).join(""),
      "there is no one who seeks God."
    );
  });

  it("preserves NET psasuper in italics without swallowing verse 1 and uppercases smcaps", () => {
    const psa23NetVerses: NetApiVerse[] = [
      {
        bookname: "Psalms",
        chapter: "23",
        verse: "1",
        text: '<p class="psasuper">A psalm of David.<p class="poetry">The <span class="smcaps">Lord</span> is my shepherd, <p class="poetry">I lack nothing. </p>',
      },
    ];

    const parsed = parseNetVerses(psa23NetVerses, "PSA", 23, defaultOptions);
    // 1. "Psalms 23", 2. "A psalm of David." (italic), 3. poetry line 1 (4 spaces), 4. poetry line 2 (8 spaces)
    assert.strictEqual(parsed.paragraphs.length, 4);
    assert.strictEqual(parsed.paragraphs[1].type, "paragraph");
    assert.strictEqual(parsed.paragraphs[1].runs[0].text, "A psalm of David.");
    assert.strictEqual(parsed.paragraphs[1].runs[0].italic, true);

    assert.strictEqual(parsed.paragraphs[2].type, "poetry");
    assert.strictEqual(parsed.paragraphs[2].indentSpaces, 4);
    assert.strictEqual(
      parsed.paragraphs[2].runs.map((r) => r.text).join(""),
      "1\u00A0The LORD is my shepherd,"
    );

    assert.strictEqual(parsed.paragraphs[3].type, "poetry");
    assert.strictEqual(parsed.paragraphs[3].indentSpaces, 8);
  });

  it("preserves NET .sosspeaker and .lamhebrew headers in bold without swallowing verse numbers", () => {
    const verses: NetApiVerse[] = [
      {
        bookname: "Psalms",
        chapter: "119",
        verse: "1",
        text: '<p class="lamhebrew"><span class="hebrew">א</span> (<i>Alef</i>)<n id="1" /><p class="poetry">How blessed are those whose actions are blameless,</p>',
      },
      {
        bookname: "The Song of Songs",
        chapter: "1",
        verse: "2",
        text: '<p class="sosspeaker"><b><i>The Beloved to Her Lover:</i></b><n id="1" /> <p class="poetry">Oh, how I wish you would kiss me passionately!</p>',
      },
    ];

    const parsed = parseNetVerses(verses, "PSA", 119, defaultOptions);
    // 1. "Psalms 119", 2. "א (Alef)" (bold), 3. v1 poetry, 4. "The Beloved..." (bold), 5. v2 poetry
    assert.strictEqual(parsed.paragraphs.length, 5);
    assert.strictEqual(parsed.paragraphs[1].runs.every((r) => r.bold), true);
    assert.strictEqual(parsed.paragraphs[2].runs[0].superscript, true);
    assert.strictEqual(parsed.paragraphs[3].runs.every((r) => r.bold), true);
    assert.strictEqual(parsed.paragraphs[4].runs[0].superscript, true);
  });
});
