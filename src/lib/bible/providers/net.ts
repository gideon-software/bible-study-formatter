import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import {
  DocParagraph,
  FormatOptions,
  ParsedChapter,
  TextRun,
  getBookById,
  normalizeParagraphRuns,
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

  // Build combined HTML with verse numbers injected and continuation poetry lines marked
  let combinedHtml = "";
  for (const v of verses) {
    let t = v.text || "";
    const vSpan = `<span class="v" data-number="${v.verse}">${v.verse}</span> `;

    // Mark 2nd+ poetic <p> tags within the same verse as continuation lines (8-space indent)
    let poetryCountInVerse = 0;
    t = t.replace(/<p\s+class="([^"]*poetry[^"]*)"\s*>/gi, (match, cls) => {
      poetryCountInVerse++;
      if (poetryCountInVerse > 1) {
        return `<p class="${cls}" data-continuation="true">`;
      }
      return match;
    });

    // If verse starts with a Psalm superscription (<p class="psasuper">), inject verse number into the following <p>
    const trimmed = t.trim();
    if (/^<p\s+class="psasuper"/i.test(trimmed)) {
      const firstClose = t.indexOf(">");
      const nextP = t.indexOf("<p", firstClose + 1);
      if (nextP !== -1) {
        const nextClose = t.indexOf(">", nextP);
        if (nextClose !== -1) {
          t = t.slice(0, nextClose + 1) + vSpan + t.slice(nextClose + 1);
        }
      } else {
        t = t.slice(0, firstClose + 1) + vSpan + t.slice(firstClose + 1);
      }
    } else if (trimmed.startsWith("<p")) {
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

    // A. Canonical Psalm superscription (<p class="psasuper">)
    if (className === "psasuper") {
      const runs = extractRuns($, $el, options, chapterNum, { italic: true });
      if (runs.length > 0) {
        paragraphs.push({
          type: "paragraph",
          runs,
        });
      }
      return;
    }

    // B. Poetry (<p class="poetry"> or <p class="otpoetry">)
    if (className.includes("poetry")) {
      const isContinuation = $el.attr("data-continuation") === "true";
      const runs = extractRuns($, $el, options, chapterNum);
      if (runs.length > 0) {
        paragraphs.push({
          type: "poetry",
          indentSpaces: isContinuation ? 8 : 4,
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
  chapterNum: number,
  initialStyle: { bold?: boolean; italic?: boolean; uppercase?: boolean } = {}
): TextRun[] {
  const runs: TextRun[] = [];

  function traverse(
    node: AnyNode,
    currentStyle: { bold?: boolean; italic?: boolean; uppercase?: boolean }
  ) {
    if (node.type === "text") {
      let text = (node as { data?: string }).data;
      if (text) {
        if (currentStyle.uppercase) {
          text = text.toUpperCase();
        }
        runs.push({
          text,
          ...(currentStyle.bold ? { bold: true } : {}),
          ...(currentStyle.italic ? { italic: true } : {}),
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
      // Note: NET wraps Old Testament quotations in <b><i>...</i></b>; we keep those in
      // plain roman text (Option 1) while uppercasing .smcaps (Lord -> LORD)
      const isUppercase =
        currentStyle.uppercase || /\bsmcaps\b/.test(className);

      elem.children?.forEach((child) => {
        traverse(child, {
          bold: currentStyle.bold,
          italic: currentStyle.italic,
          uppercase: isUppercase,
        });
      });
    }
  }

  $parent.contents().each((_, child) => {
    traverse(child, initialStyle);
  });

  return normalizeParagraphRuns(runs);
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
