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

  // Iterate over paragraphs, line-groups, and headings in the ESV container or body
  const $container = $(".esv").length > 0 ? $(".esv") : $("body");

  $container.children().each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName.toLowerCase();

    // 1. Headings (h2, h3, h4)
    if (["h2", "h3", "h4"].includes(tagName)) {
      if ($el.hasClass("psalm-title")) {
        const runs = extractRuns($, $el, options, chapterNum, { italic: true });
        if (runs.length > 0) {
          paragraphs.push({
            type: "paragraph",
            runs,
          });
        }
        return;
      }
      if (options.sectionHeadings) {
        const text = $el.text().trim();
        if (text) {
          paragraphs.push({
            type: "heading",
            isSectionHeading: true,
            alignment: "center",
            runs: [{ text, bold: true }],
          });
        }
      }
      return;
    }

    // 2. Direct poetic line (e.g. when HTML5 auto-closes <p class="block-indent"> before <h4 class="psalm-title">)
    if ($el.hasClass("line") || $el.hasClass("indent")) {
      const isIndent = $el.hasClass("indent");
      const runs = extractRuns($, $el, options, chapterNum);
      if (runs.length > 0) {
        paragraphs.push({
          type: "poetry",
          indentSpaces: isIndent ? 8 : 4,
          runs,
        });
      }
      return;
    }

    // 3. Poetry Line Groups (<p class="block-indent"> or <p class="line-group">)
    if (
      $el.hasClass("line-group") ||
      $el.hasClass("block-indent") ||
      $el.find(".line").length > 0
    ) {
      $el.find("h4.psalm-title, .line, .indent").each((_, childEl) => {
        const $child = $(childEl);
        if ($child.is("h4.psalm-title")) {
          const runs = extractRuns($, $child, options, chapterNum, { italic: true });
          if (runs.length > 0) {
            paragraphs.push({
              type: "paragraph",
              runs,
            });
          }
          return;
        }
        const isIndent = $child.hasClass("indent");
        const runs = extractRuns($, $child, options, chapterNum);
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
          bold: currentStyle.bold,
          italic: currentStyle.italic,
        });
      }
      return;
    }

    if (node.type === "tag") {
      const elem = node as Element;
      const $node = $(elem);

      // Handle Verse Numbers and Chapter Numbers
      if ($node.hasClass("verse-num") || $node.hasClass("chapter-num")) {
        if (options.verseNumbers) {
          let verseText = $node.text().trim();
          // If first verse has chapter:verse e.g. "1:1"
          if (verseText.includes(":")) {
            const parts = verseText.split(":");
            verseText = options.chapterHeaders ? parts[1].trim() : verseText;
          } else if (verseText === "1" && !options.chapterHeaders) {
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
      const isItalic =
        currentStyle.italic ||
        elem.name === "i" ||
        elem.name === "em" ||
        $node.hasClass("selah");
      const isUppercase =
        currentStyle.uppercase ||
        $node.hasClass("divine-name") ||
        $node.hasClass("small-caps");

      elem.children?.forEach((child) => {
        traverse(child, { bold: isBold, italic: isItalic, uppercase: isUppercase });
      });
    }
  }

  $parent.contents().each((_, child) => {
    traverse(child, initialStyle);
  });

  return normalizeParagraphRuns(runs);
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
    "include-headings": String(Boolean(options.sectionHeadings)),
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
