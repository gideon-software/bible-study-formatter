import { google, docs_v1 } from "googleapis";
import {
  FormatOptions,
  ParsedChapter,
  ESV_SHORT_CREDIT,
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
    type: "superscript" | "bold" | "italic" | "title" | "subtitle";
  }> = [];

  const paragraphRanges: Array<{
    startIndex: number;
    endIndex: number;
    alignment?: "CENTER" | "START" | "END";
    indentSpaces?: number;
    lineSpacing?: number;
  }> = [];

  // 2. Add Title Page if requested
  if (options.titlePage) {
    fullText += "\n\n\n\n\n\n\n\n"; // 8 empty lines
    const titleStart = fullText.length + 1;
    fullText += `${docTitle}\n`;
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
    fullText += `${versionAbbr}\n\n`;
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

    // Crossway ESV copyright attribution on title page (per https://api.esv.org/#copyright)
    if (versionAbbr === "ESV") {
      const creditStart = fullText.length + 1;
      fullText += `${ESV_SHORT_CREDIT}\n`;
      styleRanges.push({
        startIndex: creditStart,
        endIndex: fullText.length,
        type: "subtitle",
      });
      paragraphRanges.push({
        startIndex: creditStart,
        endIndex: fullText.length,
        alignment: "CENTER",
      });
    }

    // Page break placeholder
    fullText += "\u000C"; // form feed / page break
  }

  // 3. Process Each Chapter
  chapters.forEach((chapter, chIdx) => {
    // If not first chapter and chapterPageBreaks is enabled, add page break
    if (chIdx > 0 && options.chapterPageBreaks) {
      fullText += "\u000C";
    }

    chapter.paragraphs.forEach((p) => {
      const pStart = fullText.length + 1;

      // Add leading spaces for poetry indent if any
      if (p.indentSpaces && p.indentSpaces > 0) {
        fullText += " ".repeat(p.indentSpaces);
      }

      p.runs.forEach((run) => {
        const runStart = fullText.length + 1;
        fullText += run.text;
        const runEnd = fullText.length + 1;

        if (run.superscript) {
          styleRanges.push({
            startIndex: runStart,
            endIndex: runEnd,
            type: "superscript",
          });
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
      }

      paragraphRanges.push({
        startIndex: pStart,
        endIndex: pEnd,
        alignment,
        lineSpacing: options.lineSpacing * 100, // Google Docs API: 100 = single, 200 = double
      });
    });
  });

  // Crossway ESV copyright footnote at the end of the document if no title page
  // (Complies with https://api.esv.org/#copyright requirement to identify ESV)
  if (versionAbbr === "ESV" && !options.titlePage) {
    fullText += `\n${ESV_SHORT_CREDIT}\n`;
    const creditStart = fullText.length - ESV_SHORT_CREDIT.length - 1;
    styleRanges.push({
      startIndex: creditStart,
      endIndex: fullText.length,
      type: "subtitle",
    });
    paragraphRanges.push({
      startIndex: creditStart,
      endIndex: fullText.length,
      alignment: "CENTER",
    });
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
  }

  return requests;
}

/**
 * Creates the Google Doc directly in the user's Drive using OAuth 2.0 access token
 */
export async function createGoogleDocWithAuth(
  accessToken: string,
  docTitle: string,
  chapters: ParsedChapter[],
  options: FormatOptions,
  versionAbbr: string = "ESV"
): Promise<GoogleDocResult> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

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
