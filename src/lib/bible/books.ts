import { BIBLE_CHAPTER_VERSES } from "./verseCounts";

export interface BookInfo {
  id: string; // 3-letter USFM code, e.g. "GEN", "JHN"
  name: string;
  numChapters: number;
  testament: "OT" | "NT";
}

export interface FormatOptions {
  chapterHeaders: boolean;
  chapterPageBreaks: boolean;
  verseNumbers: boolean;
  sectionHeadings?: boolean;
  titlePage: boolean;
  fontName: string;
  fontSize: number;
  lineSpacing: number; // e.g. 1.0, 1.15, 1.5, 2.0
  subfolder?: string;
}

export const DEFAULT_VERSION = "ESV";

export const SUPPORTED_FONT_FAMILIES = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Roboto",
  "Trebuchet MS",
  "Verdana",
  "Courier New",
] as const;

export const FONT_FAMILY_CSS_MAP: Record<string, string> = {
  Arial: "Arial, sans-serif",
  Georgia: "Georgia, serif",
  "Times New Roman": '"Times New Roman", Times, serif',
  Roboto: "var(--font-sans), sans-serif",
  "Trebuchet MS": '"Trebuchet MS", sans-serif',
  Verdana: "Verdana, sans-serif",
  "Courier New": '"Courier New", monospace',
};

export const VALID_LINE_SPACINGS = [1, 1.15, 1.5, 2] as const;

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  chapterHeaders: true,
  chapterPageBreaks: true,
  verseNumbers: true,
  sectionHeadings: false,
  titlePage: false,
  fontName: "Arial",
  fontSize: 11,
  lineSpacing: 2,
};

/**
 * Validates and normalizes user-supplied FormatOptions against supported values.
 */
export function sanitizeFormatOptions(
  raw: Partial<FormatOptions> | null | undefined,
  fallback: FormatOptions = DEFAULT_FORMAT_OPTIONS
): FormatOptions {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const validFontsSet = new Set<string>(SUPPORTED_FONT_FAMILIES);
  const validSpacingSet = new Set<number>(VALID_LINE_SPACINGS);
  return {
    chapterHeaders:
      typeof raw.chapterHeaders === "boolean"
        ? raw.chapterHeaders
        : fallback.chapterHeaders,
    chapterPageBreaks:
      typeof raw.chapterPageBreaks === "boolean"
        ? raw.chapterPageBreaks
        : fallback.chapterPageBreaks,
    verseNumbers:
      typeof raw.verseNumbers === "boolean"
        ? raw.verseNumbers
        : fallback.verseNumbers,
    sectionHeadings:
      typeof raw.sectionHeadings === "boolean"
        ? raw.sectionHeadings
        : Boolean(fallback.sectionHeadings),
    titlePage:
      typeof raw.titlePage === "boolean" ? raw.titlePage : fallback.titlePage,
    fontName:
      typeof raw.fontName === "string" && validFontsSet.has(raw.fontName)
        ? raw.fontName
        : fallback.fontName,
    fontSize:
      typeof raw.fontSize === "number" &&
      raw.fontSize >= 8 &&
      raw.fontSize <= 24
        ? raw.fontSize
        : fallback.fontSize,
    lineSpacing:
      typeof raw.lineSpacing === "number" &&
      validSpacingSet.has(raw.lineSpacing)
        ? raw.lineSpacing
        : fallback.lineSpacing,
  };
}

export type TextAlignment = "left" | "center" | "right" | "justify";

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  superscript?: boolean;
}

export interface DocParagraph {
  type: "paragraph" | "heading" | "poetry" | "pageBreak" | "titlePage";
  isSectionHeading?: boolean;
  alignment?: TextAlignment;
  indentSpaces?: number; // 0, 4, 8 for poetry indents
  runs: TextRun[];
}

export interface ParsedChapter {
  bookId: string;
  bookName: string;
  chapterNum: number;
  paragraphs: DocParagraph[];
}

/**
 * Normalizes text runs within a paragraph to clean up upstream API artifacts
 * (such as CSB's `#—#` em-dash markers and orphaned `\u00A0` spaces left behind
 * when API.Bible strips `<span class="f">` footnotes before punctuation or spaces).
 */
export function normalizeParagraphRuns(runs: TextRun[]): TextRun[] {
  const result: TextRun[] = [];

  for (const rawRun of runs) {
    if (rawRun.superscript) {
      // If a preceding text run ended with an em-dash and trailing space, remove the space
      if (result.length > 0 && !result[result.length - 1].superscript) {
        result[result.length - 1].text = result[result.length - 1].text.replace(
          /— +$/,
          "—"
        );
      }
      result.push({ ...rawRun });
      continue;
    }

    let text = rawRun.text
      // Convert any non-breaking spaces inside body text runs into regular spaces
      .replace(/\u00A0/g, " ")
      // Strip Holman CSB `#—#` typesetting markers around em-dashes
      .replace(/\s*#—\s*#\s*/g, "—")
      .replace(/\s*#—\s*/g, "—")
      .replace(/\s*—#\s*/g, "—")
      // Collapse multiple consecutive spaces into a single space
      .replace(/ {2,}/g, " ")
      // Remove spaces immediately before closing punctuation, quotes, or em-dashes
      .replace(/ +([)\]\u201D\u2019.,;:?!—])/g, "$1")
      // Remove spaces immediately after opening parens/brackets or em-dashes
      .replace(/([(\[—]) +/g, "$1");

    // Strip trailing spaces from preceding non-superscript runs if this run starts with closing punctuation or em-dash
    while (
      result.length > 0 &&
      !result[result.length - 1].superscript &&
      /^[)\]\u201D\u2019.,;:?!—]/.test(text) &&
      result[result.length - 1].text.endsWith(" ")
    ) {
      const prev = result[result.length - 1];
      prev.text = prev.text.replace(/ +$/, "");
      if (prev.text.length === 0) {
        result.pop();
      } else {
        break;
      }
    }

    if (result.length === 0) {
      text = text.replace(/^ +/, "");
    } else {
      const prev = result[result.length - 1];
      if (prev.superscript) {
        text = text.replace(/^ +/, "");
      } else {
        if (/[(\[—]$/.test(prev.text)) {
          text = text.replace(/^ +/, "");
        }
        if (prev.text.endsWith(" ") && text.startsWith(" ")) {
          text = text.replace(/^ +/, "");
        }
      }
    }

    if (text.length > 0) {
      result.push({ ...rawRun, text });
    }
  }

  // Trim trailing spaces from the final run of the paragraph
  while (
    result.length > 0 &&
    !result[result.length - 1].superscript &&
    result[result.length - 1].text.endsWith(" ")
  ) {
    const last = result[result.length - 1];
    last.text = last.text.replace(/ +$/, "");
    if (last.text.length === 0) {
      result.pop();
    } else {
      break;
    }
  }

  return result;
}

/**
 * Applies user FormatOptions (chapterHeaders, sectionHeadings, verseNumbers)
 * to a ParsedChapter (such as a full chapter retrieved from cache).
 */
export function applyOptionsToChapter(
  chapter: ParsedChapter,
  options: FormatOptions
): ParsedChapter {
  const book = getBookById(chapter.bookId);
  const expectedChapterHeader =
    book && book.numChapters > 1
      ? `${chapter.bookName} ${chapter.chapterNum}`
      : chapter.bookName;

  const includeSectionHeadings = Boolean(options.sectionHeadings);
  const filteredParagraphs: DocParagraph[] = [];

  chapter.paragraphs.forEach((p, idx) => {
    if (p.type === "heading") {
      const fullHeadingText = p.runs.map((r) => r.text).join("").trim();
      const isMainChapterHeader =
        !p.isSectionHeading &&
        idx === 0 &&
        fullHeadingText === expectedChapterHeader;

      if (isMainChapterHeader) {
        if (options.chapterHeaders) {
          filteredParagraphs.push(p);
        }
      } else {
        // Section heading
        if (includeSectionHeadings) {
          filteredParagraphs.push(p);
        }
      }
      return;
    }

    if (p.type === "paragraph" || p.type === "poetry") {
      if (!options.verseNumbers) {
        const runsWithoutVerses = normalizeParagraphRuns(
          p.runs.filter((r) => !r.superscript)
        );
        if (runsWithoutVerses.length > 0) {
          filteredParagraphs.push({
            ...p,
            runs: runsWithoutVerses,
          });
        }
      } else {
        // Adjust verse 1 label based on whether chapterHeaders is enabled
        const adjustedRuns = normalizeParagraphRuns(
          p.runs.map((r) => {
            if (!r.superscript) return r;
            const trimmed = r.text.trim();
            if (!options.chapterHeaders && trimmed === "1") {
              return { ...r, text: `${chapter.chapterNum}:1\u00A0` };
            }
            if (
              options.chapterHeaders &&
              trimmed === `${chapter.chapterNum}:1`
            ) {
              return { ...r, text: "1\u00A0" };
            }
            return r;
          })
        );
        if (adjustedRuns.length > 0) {
          filteredParagraphs.push({
            ...p,
            runs: adjustedRuns,
          });
        }
      }
      return;
    }

    filteredParagraphs.push(p);
  });

  return {
    ...chapter,
    paragraphs: filteredParagraphs,
  };
}

export interface BibleVersion {
  id: string | number;
  abbr: string;
  name: string;
  provider: "esv" | "youversion" | "apibible" | "net";
  enabled: boolean;
}

export const SUPPORTED_VERSIONS: BibleVersion[] = [
  {
    id: "CSB",
    abbr: "CSB",
    name: "Christian Standard Bible",
    provider: "apibible",
    enabled: true,
  },
  {
    id: "ESV",
    abbr: "ESV",
    name: "English Standard Version",
    provider: "esv",
    enabled: true,
  },
  {
    id: "NASB",
    abbr: "NASB",
    name: "New American Standard Bible",
    provider: "apibible",
    enabled: true,
  },
  {
    id: "NET",
    abbr: "NET",
    name: "New English Translation",
    provider: "net",
    enabled: true,
  },
  {
    id: "NIV",
    abbr: "NIV",
    name: "New International Version",
    provider: "apibible",
    enabled: true,
  },
];

export const BIBLE_BOOKS: BookInfo[] = [
  // Old Testament
  { id: "GEN", name: "Genesis", numChapters: 50, testament: "OT" },
  { id: "EXO", name: "Exodus", numChapters: 40, testament: "OT" },
  { id: "LEV", name: "Leviticus", numChapters: 27, testament: "OT" },
  { id: "NUM", name: "Numbers", numChapters: 36, testament: "OT" },
  { id: "DEU", name: "Deuteronomy", numChapters: 34, testament: "OT" },
  { id: "JOS", name: "Joshua", numChapters: 24, testament: "OT" },
  { id: "JDG", name: "Judges", numChapters: 21, testament: "OT" },
  { id: "RUT", name: "Ruth", numChapters: 4, testament: "OT" },
  { id: "1SA", name: "1 Samuel", numChapters: 31, testament: "OT" },
  { id: "2SA", name: "2 Samuel", numChapters: 24, testament: "OT" },
  { id: "1KI", name: "1 Kings", numChapters: 22, testament: "OT" },
  { id: "2KI", name: "2 Kings", numChapters: 25, testament: "OT" },
  { id: "1CH", name: "1 Chronicles", numChapters: 29, testament: "OT" },
  { id: "2CH", name: "2 Chronicles", numChapters: 36, testament: "OT" },
  { id: "EZR", name: "Ezra", numChapters: 10, testament: "OT" },
  { id: "NEH", name: "Nehemiah", numChapters: 13, testament: "OT" },
  { id: "EST", name: "Esther", numChapters: 10, testament: "OT" },
  { id: "JOB", name: "Job", numChapters: 42, testament: "OT" },
  { id: "PSA", name: "Psalms", numChapters: 150, testament: "OT" },
  { id: "PRO", name: "Proverbs", numChapters: 31, testament: "OT" },
  { id: "ECC", name: "Ecclesiastes", numChapters: 12, testament: "OT" },
  { id: "SNG", name: "Song of Solomon", numChapters: 8, testament: "OT" },
  { id: "ISA", name: "Isaiah", numChapters: 66, testament: "OT" },
  { id: "JER", name: "Jeremiah", numChapters: 52, testament: "OT" },
  { id: "LAM", name: "Lamentations", numChapters: 5, testament: "OT" },
  { id: "EZK", name: "Ezekiel", numChapters: 48, testament: "OT" },
  { id: "DAN", name: "Daniel", numChapters: 12, testament: "OT" },
  { id: "HOS", name: "Hosea", numChapters: 14, testament: "OT" },
  { id: "JOL", name: "Joel", numChapters: 3, testament: "OT" },
  { id: "AMO", name: "Amos", numChapters: 9, testament: "OT" },
  { id: "OBA", name: "Obadiah", numChapters: 1, testament: "OT" },
  { id: "JON", name: "Jonah", numChapters: 4, testament: "OT" },
  { id: "MIC", name: "Micah", numChapters: 7, testament: "OT" },
  { id: "NAM", name: "Nahum", numChapters: 3, testament: "OT" },
  { id: "HAB", name: "Habakkuk", numChapters: 3, testament: "OT" },
  { id: "ZEP", name: "Zephaniah", numChapters: 3, testament: "OT" },
  { id: "HAG", name: "Haggai", numChapters: 2, testament: "OT" },
  { id: "ZEC", name: "Zechariah", numChapters: 14, testament: "OT" },
  { id: "MAL", name: "Malachi", numChapters: 4, testament: "OT" },

  // New Testament
  { id: "MAT", name: "Matthew", numChapters: 28, testament: "NT" },
  { id: "MRK", name: "Mark", numChapters: 16, testament: "NT" },
  { id: "LUK", name: "Luke", numChapters: 24, testament: "NT" },
  { id: "JHN", name: "John", numChapters: 21, testament: "NT" },
  { id: "ACT", name: "Acts", numChapters: 28, testament: "NT" },
  { id: "ROM", name: "Romans", numChapters: 16, testament: "NT" },
  { id: "1CO", name: "1 Corinthians", numChapters: 16, testament: "NT" },
  { id: "2CO", name: "2 Corinthians", numChapters: 13, testament: "NT" },
  { id: "GAL", name: "Galatians", numChapters: 6, testament: "NT" },
  { id: "EPH", name: "Ephesians", numChapters: 6, testament: "NT" },
  { id: "PHP", name: "Philippians", numChapters: 4, testament: "NT" },
  { id: "COL", name: "Colossians", numChapters: 4, testament: "NT" },
  { id: "1TH", name: "1 Thessalonians", numChapters: 5, testament: "NT" },
  { id: "2TH", name: "2 Thessalonians", numChapters: 3, testament: "NT" },
  { id: "1TI", name: "1 Timothy", numChapters: 6, testament: "NT" },
  { id: "2TI", name: "2 Timothy", numChapters: 4, testament: "NT" },
  { id: "TIT", name: "Titus", numChapters: 3, testament: "NT" },
  { id: "PHM", name: "Philemon", numChapters: 1, testament: "NT" },
  { id: "HEB", name: "Hebrews", numChapters: 13, testament: "NT" },
  { id: "JAS", name: "James", numChapters: 5, testament: "NT" },
  { id: "1PE", name: "1 Peter", numChapters: 5, testament: "NT" },
  { id: "2PE", name: "2 Peter", numChapters: 3, testament: "NT" },
  { id: "1JN", name: "1 John", numChapters: 5, testament: "NT" },
  { id: "2JN", name: "2 John", numChapters: 1, testament: "NT" },
  { id: "3JN", name: "3 John", numChapters: 1, testament: "NT" },
  { id: "JUD", name: "Jude", numChapters: 1, testament: "NT" },
  { id: "REV", name: "Revelation", numChapters: 22, testament: "NT" },
];

export const OT_BOOKS: BookInfo[] = BIBLE_BOOKS.filter(
  (b) => b.testament === "OT"
);

export const NT_BOOKS: BookInfo[] = BIBLE_BOOKS.filter(
  (b) => b.testament === "NT"
);

const BOOK_BY_ID_MAP = new Map<string, BookInfo>(
  BIBLE_BOOKS.map((b) => [b.id.toUpperCase(), b])
);

const BOOK_BY_NAME_MAP = new Map<string, BookInfo>(
  BIBLE_BOOKS.map((b) => [b.name.toLowerCase(), b])
);

export function getBookById(bookId: string): BookInfo | undefined {
  return BOOK_BY_ID_MAP.get(bookId.trim().toUpperCase());
}

export function getBookByNameOrId(input: string): BookInfo | undefined {
  const cleaned = input.trim();
  return (
    BOOK_BY_ID_MAP.get(cleaned.toUpperCase()) ||
    BOOK_BY_NAME_MAP.get(cleaned.toLowerCase())
  );
}

export function getBookChapters(bookId: string): number[] {
  const book = getBookById(bookId);
  if (!book) return [];
  return Array.from({ length: book.numChapters }, (_, i) => i + 1);
}

export function getVersionName(versionAbbr: string): string {
  const found = SUPPORTED_VERSIONS.find(
    (v) =>
      v.abbr.toUpperCase() === versionAbbr.toUpperCase() ||
      String(v.id).toUpperCase() === versionAbbr.toUpperCase()
  );
  return found ? found.name : versionAbbr;
}

export function getPassageTitle(
  bookId: string,
  chapterStart: number,
  chapterEnd: number
): string {
  const book = getBookById(bookId);
  const bookName = book ? book.name : bookId;
  const isFullBook =
    book && chapterStart === 1 && chapterEnd === book.numChapters;

  if (isFullBook) {
    return bookName;
  }

  if (chapterStart === chapterEnd) {
    return `${bookName} ${chapterStart}`;
  }

  return `${bookName} ${chapterStart}-${chapterEnd}`;
}

export function getDocTitle(
  bookId: string,
  chapterStart: number,
  chapterEnd: number,
  versionAbbr: string = "ESV"
): string {
  const passageTitle = getPassageTitle(bookId, chapterStart, chapterEnd);
  return `${passageTitle} (${versionAbbr})`;
}

/**
 * ============================================================================
 * Crossway ESV API Usage Policy & Copyright Compliance
 * ----------------------------------------------------------------------------
 * Reference: https://api.esv.org/#conditions and https://api.esv.org/#copyright
 *
 * Rules:
 * 1. Request Limit: Maximum 500 verses or half a book (whichever is less).
 *    Single- and double-chapter books (e.g. Obadiah, Jude, Haggai) are exempt.
 * 2. Caching: May not locally store more than 500 verses.
 * 3. Attribution: Official copyright notice must be displayed with a link
 *    to www.esv.org, and doc exports must identify the ESV.
 *
 * NOTE FOR FUTURE PERMISSIONS:
 * If Crossway grants Gideon Software permission/waiver to export full books
 * or uncap caching, simply change `enforceLimits` to `false` below.
 * ============================================================================
 */
export const ESV_POLICY_LIMITS = {
  enforceLimits: true, // Set to false if Crossway approves full-book exemption
  maxVerses: 500,
  maxHalfBook: true,
};

export const ESV_COPYRIGHT_NOTICE =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

export const ESV_SHORT_CREDIT =
  "Scripture quotations from the ESV® Bible, © 2001 Crossway. Used by permission.";

export const CSB_SHORT_CREDIT =
  "Scripture quotations marked CSB are taken from the Christian Standard Bible®, Copyright © 2017 by Holman Bible Publishers. Used by permission.";

export const NIV_SHORT_CREDIT =
  "Scripture quotations taken from The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission.";

export const NASB_SHORT_CREDIT =
  "Scripture taken from the NEW AMERICAN STANDARD BIBLE®, Copyright © 1960, 1971, 1977, 1995, 2020 by The Lockman Foundation. Used by permission.";

export const NET_SHORT_CREDIT =
  "Scripture quoted by permission. Quotations designated (NET) are from the NET Bible® copyright ©1996, 2019 by Biblical Studies Press, L.L.C. http://netbible.com All rights reserved.";

export function getVersionCredit(versionAbbr: string): string {
  switch (versionAbbr.toUpperCase()) {
    case "ESV":
      return ESV_SHORT_CREDIT;
    case "CSB":
      return CSB_SHORT_CREDIT;
    case "NIV":
      return NIV_SHORT_CREDIT;
    case "NASB":
      return NASB_SHORT_CREDIT;
    case "NET":
      return NET_SHORT_CREDIT;
    default:
      return `Scripture quotations from the ${versionAbbr} Bible.`;
  }
}

/**
 * Calculates the exact number of verses in a chapter range
 */
export function getPassageVerseCount(
  bookId: string,
  chapterStart: number,
  chapterEnd: number
): number {
  const verses = BIBLE_CHAPTER_VERSES[bookId.toUpperCase()];
  if (!verses) return 0;
  let total = 0;
  for (let ch = chapterStart; ch <= chapterEnd && ch <= verses.length; ch++) {
    total += verses[ch - 1] || 0;
  }
  return total;
}

/**
 * Validates whether the requested chapter range complies with Crossway's
 * free API distribution guidelines:
 * "Up to 500 verses or half a book, whichever is less (excepting single-chapter
 * and double-chapter books)." - https://api.esv.org/#conditions
 */
export interface EsvPolicyCheckResult {
  allowed: boolean;
  reason?: string;
  reasonPrefix?: string;
  reasonSuffix?: string;
  verseCount?: number;
  suggestedEndChapter?: number;
  suggestedRangeLabel?: string;
}

export function validateEsvPassageRange(
  bookId: string,
  chapterStart: number,
  chapterEnd: number
): EsvPolicyCheckResult {
  if (!ESV_POLICY_LIMITS.enforceLimits) {
    return { allowed: true };
  }

  const book = getBookById(bookId);
  if (!book) return { allowed: false, reason: "Invalid book ID" };

  const totalVerses = getPassageVerseCount(bookId, chapterStart, chapterEnd);

  // 1- and 2-chapter books are explicitly exempt from the half-book limit per Crossway terms
  if (book.numChapters <= 2) {
    if (totalVerses > 500) {
      return {
        allowed: false,
        verseCount: totalVerses,
        reason: `Crossway ESV policy limits exports to 500 verses. This passage contains ${totalVerses} verses.`,
      };
    }
    return { allowed: true, verseCount: totalVerses };
  }

  const numSelectedChapters = chapterEnd - chapterStart + 1;
  const maxAllowedChapters = Math.ceil(book.numChapters / 2);

  // Condition 1: Check 500-verse cap
  if (totalVerses > 500) {
    // Calculate how many chapters fit under 500 verses and under 50% of book
    let runningVerses = 0;
    let suggestedEnd = chapterStart;
    const versesArr = BIBLE_CHAPTER_VERSES[bookId.toUpperCase()] || [];
    for (let ch = chapterStart; ch <= book.numChapters; ch++) {
      const chVerses = versesArr[ch - 1] || 0;
      if (runningVerses + chVerses > 500) break;
      if (ch - chapterStart + 1 > maxAllowedChapters) break;
      runningVerses += chVerses;
      suggestedEnd = ch;
    }

    const rangeStr =
      suggestedEnd === chapterStart
        ? `chapter ${chapterStart}`
        : `chapters ${chapterStart}–${suggestedEnd}`;

    const reasonPrefix = `Crossway ESV policy limits single exports to 500 verses or half a book, whichever is less. ${book.name} ${chapterStart}–${chapterEnd} contains ${totalVerses} verses (exceeding the 500-verse cap).`;
    const reasonSuffix = `(${runningVerses} verses), or export in smaller sections.`;
    const fullReason = `${reasonPrefix} To stay within guidelines, select up to ${rangeStr} ${reasonSuffix}`;

    return {
      allowed: false,
      verseCount: totalVerses,
      reason: fullReason,
      reasonPrefix,
      reasonSuffix,
      suggestedEndChapter: suggestedEnd,
      suggestedRangeLabel: rangeStr,
    };
  }

  // Condition 2: Check half-book cap
  if (numSelectedChapters > maxAllowedChapters) {
    const suggestedEnd = Math.min(book.numChapters, chapterStart + maxAllowedChapters - 1);
    const rangeStr =
      suggestedEnd === chapterStart
        ? `chapter ${chapterStart}`
        : `chapters ${chapterStart}–${suggestedEnd}`;

    const reasonPrefix = `Crossway ESV policy limits single exports to 500 verses or half a book, whichever is less. You selected ${numSelectedChapters} of ${book.numChapters} chapters (exceeding 50% of ${book.name}).`;
    const reasonSuffix = `(50% of ${book.name}), or export in parts.`;
    const fullReason = `${reasonPrefix} To stay within guidelines, select up to ${rangeStr} ${reasonSuffix}`;

    return {
      allowed: false,
      verseCount: totalVerses,
      reason: fullReason,
      reasonPrefix,
      reasonSuffix,
      suggestedEndChapter: suggestedEnd,
      suggestedRangeLabel: rangeStr,
    };
  }

  return { allowed: true, verseCount: totalVerses };
}


