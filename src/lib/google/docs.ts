import { google, docs_v1 } from "googleapis";
import {
  FormatOptions,
  ParsedChapter,
  getVersionCredit,
  getVersionName,
} from "../bible/books";

export interface GoogleDocResult {
  docId: string;
  docUrl: string;
  docName: string;
}

/**
 * Builds Google Docs API batchUpdate requests from ParsedChapter array
 */
export function buildGoogleDocsRequests(
  chapters: ParsedChapter[],
  options: FormatOptions,
  docTitle: string,
  versionAbbr: string
): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];

  // 1. Set 1-inch margins on the whole document
  requests.push({
    updateDocumentStyle: {
      documentStyle: {
        marginTop: { magnitude: 72, unit: "PT" },
        marginBottom: { magnitude: 72, unit: "PT" },
        marginLeft: { magnitude: 72, unit: "PT" },
        marginRight: { magnitude: 72, unit: "PT" },
      },
      fields: "marginTop,marginBottom,marginLeft,marginRight",
    },
  });

  // Calculate text and operations
  // Note: Google Docs API starts with a default document that has index 1 (a single \n).
  // Inserting at index 1 is standard.
  let fullText = "";
  const styleRanges: Array<{
    startIndex: number;
    endIndex: number;
    type: "superscript" | "bold" | "italic" | "title" | "subtitle" | "copyright";
  }> = [];

  const paragraphRanges: Array<{
    startIndex: number;
    endIndex: number;
    alignment?: "CENTER" | "START" | "END";
    indentSpaces?: number;
    lineSpacing?: number;
  }> = [];

  const pageBreakIndices: number[] = [];

  // 2. Add Title Page if requested
  if (options.titlePage) {
    fullText += "\n\n\n\n\n\n\n\n"; // 8 empty lines
    const titleStart = fullText.length + 1;
    const titlePageHeading = docTitle.replace(/\s*\([^)]*\)$/, "");
    fullText += `${titlePageHeading}\n`;
    styleRanges.push({
      startIndex: titleStart,
      endIndex: fullText.length,
      type: "title",
    });
    paragraphRanges.push({
      startIndex: titleStart,
      endIndex: fullText.length,
      alignment: "CENTER",
    });

    const subTitleStart = fullText.length + 1;
    const versionName = getVersionName(versionAbbr);
    fullText += `${versionAbbr} • ${versionName}\n\n`;
    styleRanges.push({
      startIndex: subTitleStart,
      endIndex: fullText.length - 1,
      type: "subtitle",
    });
    paragraphRanges.push({
      startIndex: subTitleStart,
      endIndex: fullText.length - 1,
      alignment: "CENTER",
    });

    // Version copyright attribution on title page
    const titleCredit = getVersionCredit(versionAbbr);
    if (titleCredit) {
      const creditStart = fullText.length + 1;
      fullText += `${titleCredit}\n`;
      styleRanges.push({
        startIndex: creditStart,
        endIndex: fullText.length,
        type: "copyright",
      });
      paragraphRanges.push({
        startIndex: creditStart,
        endIndex: fullText.length,
        alignment: "CENTER",
        lineSpacing: 100,
      });
    }

    // Record page break location after title page
    pageBreakIndices.push(fullText.length + 1);
  }

  // 3. Process Each Chapter
  chapters.forEach((chapter, chIdx) => {
    // If not first chapter and chapterPageBreaks is enabled, record page break location
    if (chIdx > 0 && options.chapterPageBreaks) {
      pageBreakIndices.push(fullText.length + 1);
    }

    chapter.paragraphs.forEach((p) => {
      const pStart = fullText.length + 1;

      // Add leading spaces for poetry indent if any
      if (p.indentSpaces && p.indentSpaces > 0) {
        fullText += " ".repeat(p.indentSpaces);
      }

      p.runs.forEach((run) => {
        // Strip any control characters that Google Docs insertText would remove
        const cleanText = run.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r]/g, "");
        if (!cleanText) return;

        const runStart = fullText.length + 1;
        fullText += cleanText;
        const runEnd = fullText.length + 1;

        if (run.superscript) {
          // Only superscript the verse number itself, keeping the trailing non-breaking space (\u00A0) in regular font
          const visibleText = cleanText.replace(/[\u00A0\s]+$/, "");
          if (visibleText.length > 0) {
            styleRanges.push({
              startIndex: runStart,
              endIndex: runStart + visibleText.length,
              type: "superscript",
            });
          }
        }
        if (run.bold) {
          styleRanges.push({
            startIndex: runStart,
            endIndex: runEnd,
            type: "bold",
          });
        }
        if (run.italic) {
          styleRanges.push({
            startIndex: runStart,
            endIndex: runEnd,
            type: "italic",
          });
        }
      });

      fullText += "\n";
      const pEnd = fullText.length + 1;

      let alignment: "CENTER" | "START" | "END" = "START";
      if (p.alignment === "center" || p.type === "heading") {
        alignment = "CENTER";
      } else if (p.alignment === "right") {
        alignment = "END";
      }

      paragraphRanges.push({
        startIndex: pStart,
        endIndex: pEnd,
        alignment,
        lineSpacing: options.lineSpacing * 100, // Google Docs API: 100 = single, 200 = double
      });
    });
  });

  // Version copyright footnote at the end of the document if no title page
  if (!options.titlePage) {
    const footerCredit = getVersionCredit(versionAbbr);
    if (footerCredit) {
      fullText += "\n";
      const creditStart = fullText.length + 1;
      fullText += `${footerCredit}\n`;
      styleRanges.push({
        startIndex: creditStart,
        endIndex: fullText.length,
        type: "copyright",
      });
      paragraphRanges.push({
        startIndex: creditStart,
        endIndex: fullText.length + 1,
        alignment: "CENTER",
        lineSpacing: 100,
      });
    }
  }

  // Request: Insert Full Text at index 1
  if (fullText.length > 0) {
    requests.push({
      insertText: {
        location: { index: 1 },
        text: fullText,
      },
    });

    // Apply default font family and font size across entire document
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: 1,
          endIndex: fullText.length + 1,
        },
        textStyle: {
          weightedFontFamily: {
            fontFamily: options.fontName || "Arial",
          },
          fontSize: {
            magnitude: options.fontSize || 11,
            unit: "PT",
          },
        },
        fields: "weightedFontFamily,fontSize",
      },
    });

    // Apply Paragraph Styles (Line spacing & alignment)
    paragraphRanges.forEach((pr) => {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: pr.startIndex,
            endIndex: pr.endIndex,
          },
          paragraphStyle: {
            alignment: pr.alignment,
            lineSpacing: pr.lineSpacing || options.lineSpacing * 100,
          },
          fields: "alignment,lineSpacing",
        },
      });
    });

    // Apply Text Run Styles (Superscript, Bold, Italic, Title Styles)
    styleRanges.forEach((sr) => {
      const textStyle: docs_v1.Schema$TextStyle = {};
      const fields: string[] = [];

      if (sr.type === "superscript") {
        textStyle.baselineOffset = "SUPERSCRIPT";
        fields.push("baselineOffset");
      } else if (sr.type === "bold") {
        textStyle.bold = true;
        fields.push("bold");
      } else if (sr.type === "italic") {
        textStyle.italic = true;
        fields.push("italic");
      } else if (sr.type === "title") {
        textStyle.bold = true;
        textStyle.fontSize = { magnitude: 21, unit: "PT" };
        fields.push("bold", "fontSize");
      } else if (sr.type === "subtitle") {
        textStyle.italic = true;
        textStyle.fontSize = { magnitude: 11, unit: "PT" };
        fields.push("italic", "fontSize");
      } else if (sr.type === "copyright") {
        textStyle.italic = true;
        textStyle.fontSize = { magnitude: 8, unit: "PT" };
        fields.push("italic", "fontSize");
      }

      requests.push({
        updateTextStyle: {
          range: {
            startIndex: sr.startIndex,
            endIndex: sr.endIndex,
          },
          textStyle,
          fields: fields.join(","),
        },
      });
    });

    // Insert Page Breaks in reverse index order so earlier indices are not shifted
    [...pageBreakIndices]
      .sort((a, b) => b - a)
      .forEach((pbIndex) => {
        requests.push({
          insertPageBreak: {
            location: { index: pbIndex },
          },
        });
      });
  }

  return requests;
}

/**
 * Creates the Google Doc directly in the user's Drive using OAuth 2.0 access token
 */
export async function createGoogleDocWithAuth(
  authInput: InstanceType<typeof google.auth.OAuth2> | string,
  docTitle: string,
  chapters: ParsedChapter[],
  options: FormatOptions,
  versionAbbr: string = "ESV"
): Promise<GoogleDocResult> {
  let auth: InstanceType<typeof google.auth.OAuth2>;
  if (typeof authInput === "string") {
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: authInput });
  } else {
    auth = authInput;
  }

  const docs = google.docs({ version: "v1", auth });

  // 1. Create empty document
  const createRes = await docs.documents.create({
    requestBody: {
      title: docTitle,
    },
  });

  const docId = createRes.data.documentId;
  if (!docId) {
    throw new Error("Failed to create Google Doc: No document ID returned.");
  }

  // 2. Build structured requests
  const requests = buildGoogleDocsRequests(chapters, options, docTitle, versionAbbr);

  // 3. Apply batch updates
  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests,
      },
    });
  }

  const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

  return {
    docId,
    docUrl,
    docName: docTitle,
  };
}

/**
 * Formats a timestamp suffix for disambiguating older duplicate Google Docs in Drive,
 * e.g. "[Oct 29 @ 6:12am]".
 */
export function formatDriveTimestampSuffix(
  date: Date,
  timeZone?: string
): string {
  const formatWithTz = (tz?: string) => {
    const tzOpt = tz ? { timeZone: tz } : {};
    const monthDay = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      ...tzOpt,
    }).format(date);
    const timeStr = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...tzOpt,
    })
      .format(date)
      .replace(/\s+/g, "")
      .toLowerCase();
    return `[${monthDay} @ ${timeStr}]`;
  };

  try {
    return formatWithTz(timeZone);
  } catch {
    return formatWithTz(undefined);
  }
}

/**
 * Renames a file created by BSF in the user's Google Drive.
 */
export async function renameGoogleDriveFile(
  authInput: InstanceType<typeof google.auth.OAuth2> | string,
  fileId: string,
  newName: string
): Promise<void> {
  let auth: InstanceType<typeof google.auth.OAuth2>;
  if (typeof authInput === "string") {
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: authInput });
  } else {
    auth = authInput;
  }

  const drive = google.drive({ version: "v3", auth });
  await drive.files.update({
    fileId,
    requestBody: {
      name: newName,
    },
  });
}

/**
 * Moves a file created by BSF into the user's Google Drive Trash (recoverable for 30 days).
 */
export async function trashGoogleDriveFile(
  authInput: InstanceType<typeof google.auth.OAuth2> | string,
  fileId: string
): Promise<void> {
  let auth: InstanceType<typeof google.auth.OAuth2>;
  if (typeof authInput === "string") {
    auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: authInput });
  } else {
    auth = authInput;
  }

  const drive = google.drive({ version: "v3", auth });
  await drive.files.update({
    fileId,
    requestBody: {
      trashed: true,
    },
  });
}
