const TARGET_FOLDER_ID = "1aaA8Tiu_bzjIPaRYvWXS2A-hJ-6wfRSR";

const SPACE = " ";
const NBSP = String.fromCharCode(160);
// Don't add a space if the first character of the new text is punctuation
const PUNCT = new Set(".,:;?!)'"); // No opening parenthesis or double quotes!

var needSpace = false;
var useCaps = false;
var textDecorArr = [];
var curChapter = 0;

function addChapterXmlToDoc(docId, versionId, bookId, xml, options) {
  const doc = DocumentApp.openById(docId);
  textDecorArr = [];

  const xmlDoc = XmlService.parse(xml);
  const root = xmlDoc.getRootElement();
  addElementToDoc(doc, versionId, bookId, root, 0, options);
  if (options.chapterPageBreaks)
    doc.getBody().appendPageBreak();
  addTextDecor(doc);
}

function addElementToDoc(doc, versionId, bookId, element, level, options) {
  let body = doc.getBody();
 
  if (DEBUG_MODE)
    logElement(element,SPACE.repeat(2).repeat(level));
  
  const elClass = getClassName(element);
  const elText = element.getText().trim();
 
  //
  // Add element to doc
  //
  const firstClassWord = getFirstWord(elClass);
  let skipChildren = false;
  let textDecor = {};
 
  switch (firstClassWord) {
    case "nb": // e.g. ESV John 8:1; Non-breaking
    case "im": // e.g. NIV intro
    case "ip": // e.g. NIV intro
    case "li3": // e.g. NIV Daniel 5; MENE TEKEL PARSIN interpretations
    case "m": // e.g. ESV John 12; Occurs after OT quotes
    case "p": // Paragraph
    case "pm": // e.g. NIV Daniel 4:4
    case "pmo": // e.g. NIV Daniel 4:1
    case "pmr": // e.g. ESV Ps 41:13
      addFormattedParagraph(body, options, "");
      needSpace = false;
      break;
 
    case "pc": // e.g. NIV Daniel 5:25 (centered paragraph)
      addFormattedParagraph(body, options, "")
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      needSpace = false;
      break;

    case "add": // e.g. John 7:52 ESV
    case "d": // e.g. Psalm 3 ESV
      // Add a paragraph
      addFormattedParagraph(body, options, "");
      needSpace = false;
      textDecor.type = DocumentApp.Attribute.ITALIC;
      break;
      
    case "qs": // e.g. Selah
      // Insert some space
      body.editAsText().appendText(SPACE.repeat(4));
      textDecor.type = DocumentApp.Attribute.ITALIC;
      break;

    case "qr": // e.g. ESV Jer 30:11
      addFormattedParagraph(body, options, "")
        .setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
      needSpace = false;
      break;

    case "qt": // e.g. NIV 1 John intro
    case "it": // e.g. NET italics
      textDecor.type = DocumentApp.Attribute.ITALIC;
      break;

    case "ms": // e.g. ESV Psalm 1 (Book One)
    case "qa": // e.g. ESV Psalm 119 (acrostic headings)
    case "sp": // e.g. ESV Song of Solomon 1
    case "bd": // e.g. NET bold
      textDecor.type = DocumentApp.Attribute.BOLD;
      break;
 
    case "sc": // e.g. ESV Daniel 5:25 (MENE, MENE, TEKEL, and PARSIN), NASB John 1:23 (TODO: not quite right)
    case "nd": // e.g. ESV Psalm 3 (Lord => LORD)
      useCaps = true;
      break; 

    case "q1": // Poetry indent 1
    case "qm1": // e.g. NIV Daniel 4
      let q1Text = addFormattedParagraph(body, options, "").editAsText();
      needSpace = false;
      q1Text.appendText(SPACE.repeat(4));
      break;
 
    case "q2": // Poetry indent 2
    case "q3": // e.g. ESV Revelation 18:16
    case "qm2": // e.g. NIV Daniel 4
      let q2Text = addFormattedParagraph(body, options, "").editAsText();
      needSpace = false; 
      q2Text.appendText(SPACE.repeat(8));
      break;
      
    case "chapter": // Chapter heading
      curChapter = element.getChildren()[0].getText();  // will be chapter #

      // If chapter headers are desired
      if (options.chapterHeaders) {
        let headingStr = getBookName(versionId, bookId);
        // For all but one-chapter books, include chapter in heading
        if (getChapterList(versionId, bookId).length != 1) {
          headingStr += ` ${curChapter}`;
        }
        let chapterHeading = addFormattedParagraph(body, options, headingStr)
          .setAlignment(DocumentApp.HorizontalAlignment.CENTER).editAsText();
        needSpace = false;
        const len = chapterHeading.getText().length;
        chapterHeading.setBold(0, len - 1, true);
      }
      break;
    
    case "label": // Could be chapter or verse number; we only want verse
      if (getFirstWord(getClassName(element.getParentElement())) == "verse" &&
          options.verseNumbers) {
        let text = body.editAsText();

        // Add space if needed
        if (needSpace)
          text.appendText(SPACE);

        let offset = text.getText().length;
        let verseNum = elText;

        // If chapter headers are not desired and the book has more than one chapter, 
        // add the chapter to the first verse
        if (verseNum == 1 && !options.chapterHeaders && getChapterList(versionId, bookId).length != 1)
          verseNum = `${curChapter}:${verseNum}`;

        const numDigits = verseNum.toString().length;
        // Include a non-breaking space so the verse number sticks with the next word
        // (This avoids verse numbers at the end of lines.)
        text.appendText(verseNum + NBSP)
          .setTextAlignment(offset, offset + numDigits - 1, DocumentApp.TextAlignment.SUPERSCRIPT);
        needSpace = false; // Already added
      }
      break;
 
    case "heading":
      // Only use if part of select elements
      // - ms (e.g. Ps 1, 42)
      // - qa (e.g. Psalm 119)
      // - sp (e.g. Song of Solomon 1)
      const firstWord = getFirstWord(getClassName(element.getParentElement()));
      if (firstWord == "ms" || firstWord == "qa" || firstWord == "sp") {
        addFormattedParagraph(body, options, "");
        needSpace = false;
      }
      // Fall through to content
      else
        break;
    case "content":
      if (elText.toString().length > 0) {
        let text = body.editAsText();

        if (needSpace) {
          // Usually don't add a space if the first character of the new text is punctuation
          // Exception: if the last existing character is an opening parenthesis (e.g. Rom 4:19 ESV)
          if (!PUNCT.has(elText.charAt(0)) &&
              text.getText().substr(-1).trim() != "(") {  // e.g. Rom 4:19 ESV
            text.appendText(SPACE);
          }
        }

        // Add the content
        let content = elText.toString();
        if (useCaps)
          content = content.toUpperCase();
        text.appendText(content);

        needSpace = true;
      }
      break;
 
    case "note": // Note (important to skip as this contains "content" also; could check parent if need be)
    case "s": // Section heading
    case "s1": // Section heading
      skipChildren = true;
      break;
 
    case "b": // Extra line break; ignore
    case "book": // Not needed
    case "verse": // Not needed
    case "wj": // Words of Jesus: we don't highlight these
    case "imt": // e.g. NIV intro
    case "ie": // e.g. NIV intro
    case "tl": // e.g. NIV Daniel 5:26
      break;
 
    default: // Element we've missed!
      // Log it to general log
      logElement(element, `====================> `);

      // Log it in the missing element spreadsheet
      const isNewEntry = GssSheet.logUniqueEntry(LOG_SPREADSHEET, LOG_SHEET_MISSING_ELEMENTS,
        [firstClassWord, getVersionAbbr(versionId), getBookName(versionId, bookId), curChapter]);
      if (isNewEntry)
        GssEmail.sendDeveloperEmail("[BSF] New missing element", 
          `missing element: ${firstClassWord}; see BSF log`);

      // Add note to the top of the doc; only do this once (i.e. use cache)
      const cache = CacheService.getUserCache();
      const uniqueMissedId = `${doc.getId()}-missedelement`;
      if (cache.get(uniqueMissedId) == null) {
        cache.put(uniqueMissedId, true);
        doc.getBody().editAsText().insertText(0,
          "\n***NOTE***: an unknown formatting element(s) were found in this document, " +
          "which may mean that some text is improperly formatted or even missing. " +
          "The developer has been notified. Please forgive the inconvenience!\n");
      }

      break;
  }
 
  // If we need text decor, note starting point before adding children (content)
  if (textDecor.type) {
    textDecor.start = body.editAsText().getText().length;
  }

  // Add children to doc
  if (!skipChildren) {
    for (let child of element.getChildren())
      addElementToDoc(doc, versionId, bookId, child, level + 1, options);
  }
 
  // If we need text decor, note ending point after adding children (content)
  if (textDecor.type) {
    textDecor.end = body.editAsText().getText().length;
    textDecorArr.push(textDecor);
    textDecor = {};
  }

  // Post-processing
  switch (firstClassWord) {
    case "sc": // e.g. NASB2020 John 1:23
    case "nd": // e.g. Lord => LORD
      useCaps = false;
      break;
  }
}

function addFormattedParagraph(body, options, text) {
  return body
    .appendParagraph(text)
    .setLineSpacing(options.lineSpacing);
}

function addTextDecor(doc) {
  let text = doc.getBody().editAsText();
  for (let textDecor of textDecorArr) {
    if (DEBUG_MODE)
      Logger.log(`textDecor: ${JSON.stringify(textDecor)}`);
    if (textDecor.type == DocumentApp.Attribute.BOLD) {
      text.setBold(textDecor.start, textDecor.end - 1, true);
    } else if (textDecor.type == DocumentApp.Attribute.ITALIC) {
      text.setItalic(textDecor.start, textDecor.end - 1, true);
    }
  }
}

function getClassName(element) {
  if (element !== 'undefined' && element.getAttribute("class") !== 'undefined')
    return element.getAttribute("class").getValue().trim();
}

function getFirstWord(str) {
  return str.replace(/ .*/,'');
}

function logElement(element, prefixStr="") {
  const elName = element.getName();
  const elClass = getClassName(element);
  const elText = element.getText().trim();
 
  if (elText)
    Logger.log(`${prefixStr}${elName} ${elClass} [${elText}]`);
  else
    Logger.log(`${prefixStr}${elName} ${elClass}`);
}