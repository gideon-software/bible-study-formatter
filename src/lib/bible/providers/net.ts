import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import {
  DocParagraph,
  FormatOptions,
  ParsedChapter,
  TextRun,
  getBookById,
} from "../books";

export interface NetApiVerse {
  bookname: string;
  chapter: string;
  verse: string;
  text: string;
}

/**
 * Combines array of NET raw verse objects into clean Document AST
 */
export function parseNetVerses(
  verses: NetApiVerse[],
  bookId: string,
  chapterNum: number,
  options: FormatOptions
): ParsedChapter {
  const book = getBookById(bookId);
  const bookName = book ? book.name : bookId;
  const paragraphs: DocParagraph[] = [];

  // 1. Chapter Heading (if enabled)
  if (options.chapterHeaders) {
    let headingText = bookName;
    if (book && book.numChapters > 1) {
      headingText += ` ${chapterNum}`;
    }
    paragraphs.push({
      type: "heading",
      alignment: "center",
      runs: [{ text: headingText, bold: true }],
    });
  }

  // Build combined HTML with verse numbers injected
  let combinedHtml = "";
  for (const v of verses) {
    let t = v.text || "";
    const vSpan = `<span class="v" data-number="${v.verse}">${v.verse}</span> `;

    // If verse starts with a paragraph tag like <p class="bodytext"> or <p class="poetry">
    if (t.trim().startsWith("<p")) {
      const closeIdx = t.indexOf(">");
      t = t.slice(0, closeIdx + 1) + vSpan + t.slice(closeIdx + 1);
    } else {
      t = vSpan + t;
    }
    combinedHtml += t + " ";
  }

  const $ = cheerio.load(combinedHtml);

  // Strip footnote tags (<n id="..." />)
  $("n").remove();

  // Process top-level paragraphs (<p>)
  $("p").each((_, el) => {
    const $el = $(el);
    const className = $el.attr("class") || "";

    // A. Psalm superscription / intro (<p class="psasuper">)
    if (className === "psasuper") {
      if (options.sectionHeadings) {
        const text = $el.text().trim();
        if (text) {
          paragraphs.push({
            type: "heading",
            isSectionHeading: true,
            alignment: "center",
            runs: [{ text, italic: true }],
          });
        }
      }
      return;
    }

    // B. Poetry (<p class="poetry">)
    if (className.includes("poetry")) {
      const runs = extractRuns($, $el, options, chapterNum);
      if (runs.length > 0) {
        paragraphs.push({
          type: "poetry",
          indentSpaces: 4,
          runs,
        });
      }
      return;
    }

    // C. Regular paragraph (<p class="bodytext"> or standard <p>)
    const runs = extractRuns($, $el, options, chapterNum);
    if (runs.length > 0) {
      paragraphs.push({
        type: "paragraph",
        runs,
      });
    }
  });

  // Fallback: If no <p> tags were found (unformatted), treat all runs as a paragraph
  if (paragraphs.length === (options.chapterHeaders ? 1 : 0)) {
    const runs = extractRuns($, $("body"), options, chapterNum);
    if (runs.length > 0) {
      paragraphs.push({
        type: "paragraph",
        runs,
      });
    }
  }

  return {
    bookId,
    bookName,
    chapterNum,
    paragraphs,
  };
}

/**
 * Traverses text nodes and tags in NET Bible HTML
 */
function extractRuns(
  $: cheerio.CheerioAPI,
  $parent: cheerio.Cheerio<AnyNode>,
  options: FormatOptions,
  chapterNum: number
): TextRun[] {
  const runs: TextRun[] = [];

  function traverse(node: AnyNode, currentStyle: { bold?: boolean; italic?: boolean }) {
    if (node.type === "text") {
      const text = (node as { data?: string }).data;
      if (text) {
        runs.push({
          text,
          ...currentStyle,
        });
      }
      return;
    }

    if (node.type === "tag") {
      const elem = node as Element;
      const $node = $(elem);
      const className = $node.attr("class") || "";

      // 1. Verse Number Marker (<span class="v">)
      if (elem.name === "span" && (className.includes("v") || $node.attr("data-number"))) {
        if (options.verseNumbers) {
          let verseText = $node.attr("data-number") || $node.text().trim();
          verseText = verseText.replace(/[^\d-]/g, "");

          if (verseText) {
            if (verseText === "1" && !options.chapterHeaders) {
              verseText = `${chapterNum}:${verseText}`;
            }
            runs.push({
              text: `${verseText}\u00A0`,
              superscript: true,
            });
          }
        }
        return;
      }

      // 2. Ignore Footnotes
      if (elem.name === "n" || className.includes("footnote")) {
        return;
      }

      // 3. Styling markers
      const isBold =
        currentStyle.bold ||
        elem.name === "b" ||
        elem.name === "strong";

      const isItalic =
        currentStyle.italic ||
        elem.name === "i" ||
        elem.name === "em";

      elem.children?.forEach((child) => {
        traverse(child, { bold: isBold, italic: isItalic });
      });
    }
  }

  $parent.contents().each((_, child) => {
    traverse(child, {});
  });

  return runs;
}

/**
 * Fetches and parses a chapter of the NET Bible from labs.bible.org
 */
export async function fetchNetChapter(
  bookId: string,
  chapterNum: number,
  options: FormatOptions
): Promise<ParsedChapter> {
  const book = getBookById(bookId);
  if (!book) {
    throw new Error(`Unknown book ID: ${bookId}`);
  }

  const passageQuery = `${book.name} ${chapterNum}`;
  const url = `https://labs.bible.org/api/?passage=${encodeURIComponent(
    passageQuery
  )}&type=json&formatting=full`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NET Bible API error (${response.status}): ${errorText}`);
  }

  const verses = (await response.json()) as NetApiVerse[];
  if (!Array.isArray(verses) || verses.length === 0) {
    throw new Error(`No passage text found for ${passageQuery}`);
  }

  return parseNetVerses(verses, bookId, chapterNum, options);
}
