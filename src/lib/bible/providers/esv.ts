import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import {
  DocParagraph,
  FormatOptions,
  ParsedChapter,
  TextRun,
  getBookById,
} from "../books";

export interface EsvApiResponse {
  query: string;
  canonical: string;
  parsed: number[][];
  passage_meta: Array<{
    canonical: string;
    chapter_start: [number, number];
    chapter_end: [number, number];
    prev_verse: number | null;
    next_verse: number | null;
    prev_chapter: [number, number] | null;
    next_chapter: [number, number] | null;
  }>;
  passages: string[];
}

/**
 * Parses raw Crossway ESV HTML into our clean Document AST
 */
export function parseEsvHtml(
  html: string,
  bookId: string,
  chapterNum: number,
  options: FormatOptions
): ParsedChapter {
  const book = getBookById(bookId);
  const bookName = book ? book.name : bookId;
  const paragraphs: DocParagraph[] = [];

  const $ = cheerio.load(html);

  // If chapter headers are enabled, add chapter heading
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

  // Iterate over paragraphs, line-groups, and headings in the ESV container
  $(".esv > *").each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();

    // 1. Headings (h2, h3, h4)
    if (["h2", "h3", "h4"].includes(tagName)) {
      if (options.chapterHeaders) {
        const text = $el.text().trim();
        if (text) {
          paragraphs.push({
            type: "heading",
            alignment: "center",
            runs: [{ text, bold: true }],
          });
        }
      }
      return;
    }

    // 2. Poetry Line Groups (<p class="line-group"> or <div class="line-group">)
    if ($el.hasClass("line-group")) {
      $el.find(".line, .indent").each((_, lineEl) => {
        const $line = $(lineEl);
        const isIndent = $line.hasClass("indent");
        const runs = extractRuns($, $line, options, chapterNum);
        if (runs.length > 0) {
          paragraphs.push({
            type: "poetry",
            indentSpaces: isIndent ? 8 : 4,
            runs,
          });
        }
      });
      return;
    }

    // 3. Standard Paragraphs (<p>)
    if (tagName === "p") {
      const runs = extractRuns($, $el, options, chapterNum);
      if (runs.length > 0) {
        paragraphs.push({
          type: "paragraph",
          runs,
        });
      }
      return;
    }
  });

  return {
    bookId,
    bookName,
    chapterNum,
    paragraphs,
  };
}

/**
 * Traverses text nodes and styling tags (verse-num, bold, italic)
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

      // Handle Verse Numbers
      if ($node.hasClass("verse-num")) {
        if (options.verseNumbers) {
          let verseText = $node.text().trim();
          // If first verse and chapter headers are disabled, show "Chapter:Verse" (e.g. 1:1)
          if (verseText === "1" && !options.chapterHeaders) {
            verseText = `${chapterNum}:${verseText}`;
          }
          runs.push({
            text: `${verseText}\u00A0`, // non-breaking space
            superscript: true,
          });
        }
        return; // Don't traverse inside verse-num
      }

      // Ignore footnotes and references
      if ($node.hasClass("footnote") || $node.hasClass("crossref")) {
        return;
      }

      const isBold = currentStyle.bold || elem.name === "b" || elem.name === "strong";
      const isItalic = currentStyle.italic || elem.name === "i" || elem.name === "em";

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
 * Fetches and parses a single chapter from the Crossway ESV API
 */
export async function fetchEsvChapter(
  bookId: string,
  chapterNum: number,
  options: FormatOptions,
  apiKey?: string
): Promise<ParsedChapter> {
  const book = getBookById(bookId);
  if (!book) {
    throw new Error(`Unknown book ID: ${bookId}`);
  }

  const token = apiKey || process.env.ESV_API_KEY;
  if (!token) {
    throw new Error(
      "Crossway ESV API Key is missing. Please set ESV_API_KEY in your environment or settings."
    );
  }

  const passageQuery = `${book.name} ${chapterNum}`;
  const params = new URLSearchParams({
    q: passageQuery,
    "include-headings": String(options.chapterHeaders),
    "include-footnotes": "false",
    "include-verse-numbers": String(options.verseNumbers),
    "include-short-copyright": "false",
    "include-passage-references": "false",
  });

  const response = await fetch(
    `https://api.esv.org/v3/passage/html/?${params.toString()}`,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Crossway ESV API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as EsvApiResponse;
  const rawHtml = data.passages.join("\n");

  return parseEsvHtml(rawHtml, bookId, chapterNum, options);
}
