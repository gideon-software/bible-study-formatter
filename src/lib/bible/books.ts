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
    name: "Christian Standard Bible (Coming Soon)",
    provider: "youversion",
    enabled: false,
  },
  {
    id: "NIV",
    abbr: "NIV",
    name: "New International Version (Coming Soon)",
    provider: "youversion",
    enabled: false,
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
