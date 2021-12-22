/**
 * Bible Study Formatter
 *
 * Copyright 2019-2021 Gideon Software <gideonsoftwaresolutions@gmail.com>
**/

const DEBUG_MODE = false;
const LOG_SPREADSHEET = "1UaJORxJ3aHaRh_VerQ3rKBy5L2MaxcKR1ryIqu3g2LU";
const LOG_SHEET_MISSING_ELEMENTS = "Missing elements";
const LOG_SHEET_EXECUTION_HISTORY = "Execution history"

function addChapter(docId, versionId, bookId, chapterId, options={}) {
  Logger.log(`addChapter(${docId}, ${versionId}, ${bookId}, ${chapterId}, ${JSON.stringify(options)})`);
  const xml = getChapterXml(versionId, chapterId);
  addChapterXmlToDoc(docId, versionId, bookId, xml, options);
}

function addTitlePage(docId, versionId, bookId, chapterStartId, chapterEndId) {
  const doc = DocumentApp.openById(docId);
  let body = doc.getBody();
  let heading1 = getDocName(versionId, bookId, chapterStartId, chapterEndId, false);
  let p = 0;
  while (p <= 4)
    body.insertParagraph(p++, "")
    .setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.insertParagraph(p++, heading1)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.insertParagraph(p++, getVersionAbbr(versionId))
    .setHeading(DocumentApp.ParagraphHeading.SUBTITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.insertPageBreak(p++);
  return docId;
}

function createGoogleDoc(versionId, bookId, chapterStartId, chapterEndId, options) {
  // First log this execution
  GssSheet.logEntry(LOG_SPREADSHEET, LOG_SHEET_EXECUTION_HISTORY,
    [new Date(), 
      getVersionAbbr(versionId), 
      getBookName(versionId, bookId),
      chapterStartId,
      chapterEndId]);

  // Get doc name
  let docName = getDocName(versionId, bookId, chapterStartId, chapterEndId, true);
  Logger.log(`docName: ${docName}`);

  // Create doc
  const doc = DocumentApp.create(docName);
  const docUrl = doc.getUrl();
  Logger.log(`docUrl: ${docUrl}`);

  // Move doc to target location & make editable by all
  const file = DriveApp.getFileById(doc.getId());
  const baseFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  const now = new Date();
  let subFolderName = now.toISOString().split('T')[0];
  if (options.subfolder)
    subFolderName = options.subfolder;
  let subFolder = null;
  try {
    subFolder = baseFolder.getFoldersByName(subFolderName).next(); // Won't throw an exception if not found
    subFolderName = subFolder.getName(); // Will throw exception if not found
  } catch(e) {
    subFolder = baseFolder.createFolder(subFolderName);
  }
  file.moveTo(subFolder);
  file.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.EDIT);

  return doc.getId();
}

function doGet(e) {
  Logger.log(`doGet(${JSON.stringify(e)})`);
  // Set XFrameOptionsMode for embedding in Google Site.
  // TODO: Prevent clickjacking!
  // See https://stackoverflow.com/a/57139742/1307022
  let template = HtmlService.createTemplateFromFile('index');
  template.params = e.parameter;
  return template
    .evaluate()
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('Bible Study Formatter')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    //.setFaviconUrl('https://storage.cloud.google.com/bible-study-formatter/images/png/bsf-32x32.png');
}

function finalizeDoc(docId, versionId, bookId, chapterStartId, chapterEndId, options) {
  const doc = DocumentApp.openById(docId);

  // Change font
  doc.getBody().editAsText()
   .setFontFamily(options.fontName)
   .setFontSize(options.fontSize);

  // Add title page if selected
  if (options.titlePage)
    addTitlePage(docId, versionId, bookId, chapterStartId, chapterEndId);

  // Remove first newline in doc
  doc.getBody().getParagraphs()[0].removeFromParent();
  
  return { docUrl: doc.getUrl(), docName: doc.getName() }
}

function getDocName(versionId, bookId, chapterStartId, chapterEndId, includeVersion=true) {
  // Get doc name
  let docName = getBookName(versionId, bookId);
  if (!isFirstChapter(versionId, bookId, chapterStartId) || !isLastChapter(versionId, bookId, chapterEndId)) {
    // We're not getting the entire book
    const chapterStartName = getChapterName(versionId, bookId, chapterStartId);
    docName += ` ${chapterStartName}`;
    if (chapterStartId != chapterEndId) {
      const chapterEndName = getChapterName(versionId, bookId, chapterEndId);
      docName += "-" + chapterEndName;
    }
  }
  if (includeVersion) {
    const versionAbbr = getVersionAbbr(versionId);
    docName += ` (${versionAbbr})`;
  }
  return docName;
}
