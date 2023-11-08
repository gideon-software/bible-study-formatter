function testAddChapter() {
  const docId = "1NV4Wilf5F4qj5lYgeoo8pp72j_QQdepj0YwEAJadxGw";
  const versionId = 59;
  const options = {
    chapterHeaders: true,
    chapterPageBreaks: true,
    verseNumbers: true,
    titlePage: false,
    fontName: "Arial",
    fontSize: 11,
    lineSpacing: 2
  }
  //addChapter(docId, versionId, "JER", "JER.30", options);
  //addChapter(docId, versionId, "JHN", "JHN.1", options);
  //addChapter(docId, versionId, "JHN", "JHN.8", options);
  //addChapter(docId, versionId, "ROM", "ROM.1", options);
  addChapter(docId, versionId, "EPH", "EPH.1", options);
}

// Doesn't work yet!
function testVersion(versionId) {
  versionId = versionId || 59; // ESV
  let devUrl = "https://script.google.com/macros/s/AKfycbxpmLS8pfgGlAFKHERZ-pDBFfU2-0cHfpOSfo9ZmUGB/dev";
  //const bookArr = getBookList(versionId);
  const bookArr = ["2JN","3JN"];
  let requests = [];
  for (let bookId of bookArr) {
    const url = devUrl
      + `?versionId=${versionId}`
      + `&bookId=${bookId}`
      + "&wholeBook=1"
      + "&subfolder=test"
      + "&autorun=1";
    const request = {
      url: url,
      muteHttpExceptions: false
    }
    Logger.log(request.url);
    requests.push(request);
  }
  let responses = UrlFetchApp.fetchAll(requests);
  for (let r of responses)
    Logger.log(r.getContentText());
}
