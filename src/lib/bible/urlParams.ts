import {
  BIBLE_BOOKS,
  SUPPORTED_VERSIONS,
  SUPPORTED_FONT_FAMILIES,
  FormatOptions,
  getBookByNameOrId,
} from "./books";

export const ALLOWED_FONTS = SUPPORTED_FONT_FAMILIES;

export interface ParsedUrlSettings {
  versionId?: string;
  bookId?: string;
  chapterStart?: number;
  chapterEnd?: number;
  options?: Partial<FormatOptions>;
  hasUrlSettings: boolean;
}

/**
 * Normalizes a book query string and finds the matching book ID.
 * Supports 3-letter codes ("ROM", "JHN"), full names ("Romans", "1 Corinthians"),
 * and case-insensitive whitespace-tolerant comparisons.
 */
export function matchBookId(query: string): string | null {
  if (!query || typeof query !== "string") return null;
  const direct = getBookByNameOrId(query);
  if (direct) return direct.id;

  const condensed = query.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!condensed) return null;

  // Condensed match (handles "1corinthians", "songofsolomon", etc.)
  const condensedMatch = BIBLE_BOOKS.find((b) => {
    const bCondensed = b.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    return bCondensed === condensed;
  });
  return condensedMatch ? condensedMatch.id : null;
}

/**
 * Parses a boolean URL parameter value (e.g. "1", "0", "true", "false", "yes", "no").
 */
export function parseBoolParam(val: string | null): boolean | undefined {
  if (val === null || val === undefined) return undefined;
  const lower = val.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(lower)) return true;
  if (["0", "false", "no", "off"].includes(lower)) return false;
  return undefined;
}

/**
 * Parses URL search parameters for Bible Study Formatter options.
 */
export function parseUrlSettings(search: string | URLSearchParams): ParsedUrlSettings {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const result: ParsedUrlSettings = { hasUrlSettings: false };

  // 1. Version (e.g. ?v=CSB or ?version=esv)
  const rawVersion = params.get("v") || params.get("version");
  if (rawVersion) {
    const foundVersion = SUPPORTED_VERSIONS.find(
      (v) =>
        v.abbr.toLowerCase() === rawVersion.trim().toLowerCase() ||
        String(v.id).toLowerCase() === rawVersion.trim().toLowerCase()
    );
    if (foundVersion && foundVersion.enabled) {
      result.versionId = foundVersion.abbr;
      result.hasUrlSettings = true;
    }
  }

  // 2. Book (e.g. ?book=ROM or ?book=Romans)
  const rawBook = params.get("book") || params.get("b");
  if (rawBook) {
    const matched = matchBookId(rawBook);
    if (matched) {
      result.bookId = matched;
      result.hasUrlSettings = true;
    }
  }

  // 3. Chapters (e.g. ?start=12&end=14 or ?ch=12)
  const rawStart = params.get("start") || params.get("ch") || params.get("chapter");
  const rawEnd = params.get("end");

  const book = result.bookId ? BIBLE_BOOKS.find((b) => b.id === result.bookId) : null;
  const maxCh = book ? book.numChapters : 150;

  let parsedStart: number | undefined;
  if (rawStart) {
    const s = parseInt(rawStart, 10);
    if (!isNaN(s) && s >= 1) {
      parsedStart = Math.min(s, maxCh);
      result.chapterStart = parsedStart;
      result.hasUrlSettings = true;
    }
  }

  if (rawEnd) {
    const e = parseInt(rawEnd, 10);
    if (!isNaN(e) && e >= 1) {
      const minVal = parsedStart || 1;
      result.chapterEnd = Math.min(Math.max(e, minVal), maxCh);
      result.hasUrlSettings = true;
    }
  } else if (parsedStart !== undefined) {
    // If only start chapter is specified, default chapterEnd to chapterStart
    result.chapterEnd = parsedStart;
  }

  // 4. Formatting options
  const optionsObj: Partial<FormatOptions> = {};
  let hasFormatOption = false;

  // Font family
  const rawFont = params.get("font");
  if (rawFont) {
    const matchedFont = ALLOWED_FONTS.find(
      (f) => f.toLowerCase() === rawFont.trim().toLowerCase()
    );
    if (matchedFont) {
      optionsObj.fontName = matchedFont;
      hasFormatOption = true;
    }
  }

  // Font size (pt)
  const rawSize = params.get("size");
  if (rawSize) {
    const sizeNum = parseInt(rawSize, 10);
    if (!isNaN(sizeNum) && sizeNum >= 8 && sizeNum <= 24) {
      optionsObj.fontSize = sizeNum;
      hasFormatOption = true;
    }
  }

  // Line spacing
  const rawSpacing = params.get("spacing");
  if (rawSpacing) {
    const sp = parseFloat(rawSpacing);
    if ([1, 1.0, 1.15, 1.5, 2, 2.0].includes(sp)) {
      optionsObj.lineSpacing = sp;
      hasFormatOption = true;
    }
  }

  // Switches
  const headers = parseBoolParam(params.get("headers"));
  if (headers !== undefined) {
    optionsObj.chapterHeaders = headers;
    hasFormatOption = true;
  }

  const breaks = parseBoolParam(params.get("breaks"));
  if (breaks !== undefined) {
    optionsObj.chapterPageBreaks = breaks;
    hasFormatOption = true;
  }

  const verses = parseBoolParam(params.get("verses"));
  if (verses !== undefined) {
    optionsObj.verseNumbers = verses;
    hasFormatOption = true;
  }

  const sections = parseBoolParam(
    params.get("sections") || params.get("sectionHeadings")
  );
  if (sections !== undefined) {
    optionsObj.sectionHeadings = sections;
    hasFormatOption = true;
  }

  const titlePage = parseBoolParam(params.get("titlePage") || params.get("title"));
  if (titlePage !== undefined) {
    optionsObj.titlePage = titlePage;
    hasFormatOption = true;
  }

  if (hasFormatOption) {
    result.options = optionsObj;
    result.hasUrlSettings = true;
  }

  return result;
}

/**
 * Builds a shareable BSF URL that reproduces a specific Bible passage and formatting options.
 */
export function buildShareableUrl(params: {
  baseUrl: string;
  versionId: string;
  bookId: string;
  chapterStart: number;
  chapterEnd: number;
  options?: Partial<FormatOptions> | null;
}): string {
  const searchParams = new URLSearchParams();
  searchParams.set("v", params.versionId);
  searchParams.set("book", params.bookId);
  searchParams.set("start", String(params.chapterStart));
  searchParams.set("end", String(params.chapterEnd));

  const opt = params.options;
  if (opt) {
    if (opt.chapterHeaders !== undefined) {
      searchParams.set("headers", opt.chapterHeaders ? "1" : "0");
    }
    if (opt.chapterPageBreaks !== undefined) {
      searchParams.set("breaks", opt.chapterPageBreaks ? "1" : "0");
    }
    if (opt.verseNumbers !== undefined) {
      searchParams.set("verses", opt.verseNumbers ? "1" : "0");
    }
    if (opt.sectionHeadings !== undefined) {
      searchParams.set("sections", opt.sectionHeadings ? "1" : "0");
    }
    if (opt.titlePage !== undefined) {
      searchParams.set("title", opt.titlePage ? "1" : "0");
    }
    if (opt.fontName) {
      searchParams.set("font", opt.fontName);
    }
    if (opt.fontSize !== undefined) {
      searchParams.set("size", String(opt.fontSize));
    }
    if (opt.lineSpacing !== undefined) {
      searchParams.set("spacing", String(opt.lineSpacing));
    }
  }

  const cleanBase = params.baseUrl.replace(/\/$/, "");
  return `${cleanBase}/?${searchParams.toString()}`;
}
