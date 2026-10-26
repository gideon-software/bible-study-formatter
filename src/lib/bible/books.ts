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
  titlePage: boolean;
  fontName: string;
  fontSize: number;
  lineSpacing: number; // e.g. 1.0, 1.15, 1.5, 2.0
  subfolder?: string;
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

export interface BibleVersion {
  id: string | number;
  abbr: string;
  name: string;
  provider: "esv" | "youversion" | "apibible";
  enabled: boolean;
}

export const SUPPORTED_VERSIONS: BibleVersion[] = [
  {
    id: "ESV",
    abbr: "ESV",
    name: "English Standard Version",
    provider: "esv",
    enabled: true,
  },
  {
    id: "CSB",
    abbr: "CSB",
    name: "Christian Standard Bible",
    provider: "apibible",
    enabled: true,
  },
  {
    id: "NIV",
    abbr: "NIV",
    name: "New International Version",
    provider: "apibible",
    enabled: true,
  },
  {
    id: "NASB",
    abbr: "NASB",
    name: "New American Standard Bible",
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

export function getBookById(bookId: string): BookInfo | undefined {
  return BIBLE_BOOKS.find((b) => b.id.toUpperCase() === bookId.toUpperCase());
}

export function getBookChapters(bookId: string): number[] {
  const book = getBookById(bookId);
  if (!book) return [];
  return Array.from({ length: book.numChapters }, (_, i) => i + 1);
}

export function getDocTitle(
  bookId: string,
  chapterStart: number,
  chapterEnd: number,
  versionAbbr: string = "ESV"
): string {
  const book = getBookById(bookId);
  const bookName = book ? book.name : bookId;
  const isFullBook =
    book && chapterStart === 1 && chapterEnd === book.numChapters;

  if (isFullBook) {
    return `${bookName} (${versionAbbr})`;
  }

  if (chapterStart === chapterEnd) {
    return `${bookName} ${chapterStart} (${versionAbbr})`;
  }

  return `${bookName} ${chapterStart}-${chapterEnd} (${versionAbbr})`;
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
export function validateEsvPassageRange(
  bookId: string,
  chapterStart: number,
  chapterEnd: number
): { allowed: boolean; reason?: string; verseCount?: number } {
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
    // Calculate how many chapters fit under 500 verses
    let runningVerses = 0;
    let suggestedEnd = chapterStart;
    const versesArr = BIBLE_CHAPTER_VERSES[bookId.toUpperCase()] || [];
    for (let ch = chapterStart; ch <= book.numChapters; ch++) {
      const chVerses = versesArr[ch - 1] || 0;
      if (runningVerses + chVerses > 500) break;
      runningVerses += chVerses;
      suggestedEnd = ch;
    }

    const rangeStr =
      suggestedEnd === chapterStart
        ? `chapter ${chapterStart}`
        : `chapters ${chapterStart}–${suggestedEnd}`;

    return {
      allowed: false,
      verseCount: totalVerses,
      reason: `Crossway ESV policy limits single exports to 500 verses or half a book, whichever is less. ${book.name} ${chapterStart}–${chapterEnd} contains ${totalVerses} verses (exceeding the 500-verse cap). To stay within guidelines, select up to ${rangeStr} (${runningVerses} verses), or export in smaller sections.`,
    };
  }

  // Condition 2: Check half-book cap
  if (numSelectedChapters > maxAllowedChapters) {
    return {
      allowed: false,
      verseCount: totalVerses,
      reason: `Crossway ESV policy limits single exports to 500 verses or half a book, whichever is less. You selected ${numSelectedChapters} of ${book.numChapters} chapters (exceeding 50% of ${book.name}). To format ${book.name}, export in parts (e.g. chapters 1–${maxAllowedChapters} and ${maxAllowedChapters + 1}–${book.numChapters}).`,
    };
  }

  return { allowed: true, verseCount: totalVerses };
}


