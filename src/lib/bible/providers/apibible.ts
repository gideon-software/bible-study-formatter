import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import {
  DocParagraph,
  FormatOptions,
  ParsedChapter,
  TextRun,
  getBookById,
} from "../books";

export const API_BIBLE_DEFAULT_IDS: Record<string, string> = {
  CSB: process.env.API_BIBLE_CSB_ID || "a556c5305ee15c3f-01",
  NIV: process.env.API_BIBLE_NIV_ID || "78a9f6124f344018-01",
  NASB: process.env.API_BIBLE_NASB_ID || "a761ca71e0b3ddcf-01",
};

export interface ApiBibleChapterResponse {
  data: {
    id: string;
    bibleId: string;
    number: string;
    bookId: string;
    reference: string;
    content: string;
    verseCount: number;
    copyright?: string;
  };
}

/**
 * Parses raw API.Bible HTML (USFM/USX standard) into clean Document AST
 */
export function parseApiBibleHtml(
  html: string,
  bookId: string,
  chapterNum: number,
  options: FormatOptions
): ParsedChapter {
  const book = getBookById(bookId);
  const bookName = book ? book.name : bookId;
  const paragraphs: DocParagraph[] = [];

  const $ = cheerio.load(html);

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

  // Find root containers or direct body children
  const root = $(".scripture-styles").length ? $(".scripture-styles") : $("body");
  const children = root.children();

  // If there are top-level wrapper elements or direct paragraphs:
  const nodesToProcess = children.length > 0 ? children : $("p, h2, h3, h4, div");

  nodesToProcess.each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase() || "";
    const className = $el.attr("class") || "";

    // Skip footnotes and crossrefs container or chapter markers
    if ($el.hasClass("c") || $el.hasClass("f") || $el.hasClass("x")) {
      return;
    }

    // A. Section Headings (\s, \s1, \s2, \ms, h2, h3, h4)
    if (
      ["h2", "h3", "h4"].includes(tagName) ||
      /\b(s[1-4]?|ms[1-4]?|r|mr)\b/.test(className)
    ) {
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

    // B. Poetry Line Groups (\q, \q1, \q2, \q3, \q4, \qc, \qr)
    if (/\bq[1-4]?\b/.test(className)) {
      const isDeeperIndent = /\bq[2-4]\b/.test(className);
      const runs = extractRuns($, $el, options, chapterNum);
      if (runs.length > 0) {
        paragraphs.push({
          type: "poetry",
          indentSpaces: isDeeperIndent ? 8 : 4,
          runs,
        });
      }
      return;
    }

    // C. Poetry Stanza Break (\b)
    if ($el.hasClass("b")) {
      // Line break / stanza spacing
      return;
    }

    // D. Standard Prose Paragraphs (\p, \m, \pi, \nb, or generic <p> / <div>)
    if (tagName === "p" || tagName === "div" || /\b(p|m|pi|nb)\b/.test(className)) {
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
 * Traverses USFM/HTML text nodes and inline styling tags (verse, bold, italic, words of Jesus)
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

      // 1. Verse Number Marker (\v or .v)
      if (className.split(/\s+/).includes("v") || $node.attr("data-number")) {
        if (options.verseNumbers) {
          let verseText = $node.attr("data-number") || $node.text().trim();
          // Clean non-digits if needed
          verseText = verseText.replace(/[^\d-]/g, "");

          if (verseText) {
            // If first verse and chapter headers are disabled, show "Chapter:Verse" (e.g. 1:1)
            if (verseText === "1" && !options.chapterHeaders) {
              verseText = `${chapterNum}:${verseText}`;
            }
            runs.push({
              text: `${verseText}\u00A0`, // non-breaking space
              superscript: true,
            });
          }
        }
        return; // Don't traverse inside verse number marker
      }

      // 2. Ignore Footnotes (\f), Cross References (\x), and Chapter Labels (\c)
      if (/\b(f|fe|x|c)\b/.test(className)) {
        return;
      }

      // 3. Styling markers (bold, italic, translator additions, words of Jesus)
      const isBold =
        currentStyle.bold ||
        elem.name === "b" ||
        elem.name === "strong" ||
        /\b(bd|b)\b/.test(className);

      const isItalic =
        currentStyle.italic ||
        elem.name === "i" ||
        elem.name === "em" ||
        /\b(it|add|bk)\b/.test(className);

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
 * Fetches and parses a single chapter from the American Bible Society API.Bible
 */
export async function fetchApiBibleChapter(
  bookId: string,
  chapterNum: number,
  versionId: string,
  options: FormatOptions,
  apiKey?: string
): Promise<ParsedChapter> {
  const book = getBookById(bookId);
  if (!book) {
    throw new Error(`Unknown book ID: ${bookId}`);
  }

  const token = apiKey || process.env.API_BIBLE_KEY;
  if (!token) {
    throw new Error(
      `API.Bible API key is missing. Please set API_BIBLE_KEY in .env.local to access ${versionId}.`
    );
  }

  const bibleId = API_BIBLE_DEFAULT_IDS[versionId.toUpperCase()];
  if (!bibleId) {
    throw new Error(`Unsupported API.Bible version: ${versionId}`);
  }

  // API.Bible chapter identifier format: {USFM_BOOK}.{CHAPTER_NUM} e.g. "JHN.1"
  const chapterId = `${book.id.toUpperCase()}.${chapterNum}`;

  const queryParams = new URLSearchParams({
    "content-type": "html",
    "include-notes": "false",
    "include-titles": String(Boolean(options.sectionHeadings)),
    "include-chapter-numbers": "false",
    "include-verse-numbers": String(options.verseNumbers),
    "include-verse-spans": "false",
  });

  const url = `https://rest.api.bible/v1/bibles/${bibleId}/chapters/${chapterId}?${queryParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      "api-key": token,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `API.Bible authorization error (${response.status}): Please check your API_BIBLE_KEY and ensure ${versionId} (${bibleId}) is added to your account plan.`
      );
    }
    throw new Error(`API.Bible error (${response.status}): ${errorText}`);
  }

  const json = (await response.json()) as ApiBibleChapterResponse;
  const rawHtml = json.data?.content || "";

  return parseApiBibleHtml(rawHtml, bookId, chapterNum, options);
}
