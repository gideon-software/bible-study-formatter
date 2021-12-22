function getBookList(versionId) {
  let bookArr = [];
  
   // First try loading from cache
  const cache = CacheService.getScriptCache();
  const uniqueId = `${versionId}-books`;
  const booksStr = cache.get(uniqueId);
  if (booksStr != null)
    return JSON.parse(booksStr);

  const url = `https://www.bible.com/json/bible/books/${versionId}`;
  const json = UrlFetchApp.fetch(url).getContentText();
  const data = JSON.parse(json);
  
  for (let item of data.items) {
    const name = item.human;
    const id = item.usfm;
    //Logger.log(`name: ${name}, id: ${id}`);
    bookArr.push({name, id});
  }

  cache.put(uniqueId, JSON.stringify(bookArr), 21600);
  return bookArr;
}

function getBookName(versionId, bookId) {
  const bookArr = getBookList(versionId);
  for (let book of bookArr) {
    if (book.id == bookId)
      return book.name;
  }
}

function getChapterList(versionId, bookId) {
  let chapterArr = [];
 
   // First try loading from cache
  const cache = CacheService.getScriptCache();
  const uniqueId = `${versionId}-${bookId}-chapters`;
  const chaptersStr = cache.get(uniqueId);
  if (chaptersStr != null)
    return JSON.parse(chaptersStr);

  const url = `https://www.bible.com/json/bible/books/${versionId}/${bookId}/chapters`;
  const json = UrlFetchApp.fetch(url).getContentText();
  const data = JSON.parse(json);
  
  for (let item of data.items) {
    const num = item.human;
    const id = item.usfm;
    //Logger.log(`num: ${num}, id: ${id}`);
    chapterArr.push({num, id});
  }
  
  cache.put(uniqueId, JSON.stringify(chapterArr), 21600);
  return chapterArr;
}

function getChapterName(versionId, bookId, chapterId) {
  const chapterArr = getChapterList(versionId, bookId);
  for (let chapter of chapterArr) {
    if (chapter.id == chapterId)
      return chapter.num;
  }
}

function getChapterXml(versionId, chapterId) {
  const fullChapterId = `${versionId}/${chapterId}`;

  // First try loading from cache
  const cache = CacheService.getScriptCache();
  const cachedXml = cache.get(fullChapterId);
  if (cachedXml != null)
    return cachedXml;

  // No cache; load from bible.com
  const srcUrl = `https://www.bible.com/bible/${fullChapterId}`;
  
  // We can't load the whole page via XmlService.parse(), so we have to get the section we need
  const html = UrlFetchApp.fetch(srcUrl).getContentText();
  
  // Trim from <div class="book bk___"> to </div></div></div>
  const regex = /.*(<div class="book bk.*<\/div>\s+<\/div>\s+<\/div>)\s+<\/div><\/div><\/div>.*/s; // s = dot matches single line
  const matches = html.match(regex);
  if (!matches)
    return "";
  const xml = matches[1];
  try {
    cache.put(fullChapterId, xml, 21600);
  } catch (e) {
    Logger.log("Can't cache xml", e);
  }
  if (DEBUG_MODE)
    Logger.log(`XML:\n${xml}`);
  return xml;
}

function getVersionAbbr(versionId) {
  const versionArr = getVersionList();
  for (let version of versionArr) {
    if (version.id == versionId)
      return version.abbr;
  }
}

function getVersionList(langId="eng") {
  let versionArr = [];

  // Only load known working versions for now
  versionArr = [
    {abbr:"ESV", name:"English Standard Version 2016", id:59},
//    {abbr:"NIV", name:"New International Version", id:111},

    // TODO: NASB John 1:23 has space issue... may need to rethink empty content...?
//    {abbr:"NASB", name:"New American Standard Bible", id:2692},

  // {id=1588, name="Amplified Bible", abbr="AMP"},
  // {name=Holman Christian Standard Bible, id=72.0, abbr=HCSB}, 
  // {abbr=KJV, name=King James Version, id=1.0}, 
  // {id=97.0, name=The Message, abbr=MSG}, 
  // {name=New American Standard Bible - NASB 1995, id=100.0, abbr=NASB1995}, 
  // {name=New English Translation, abbr=NET, id=107.0}, 
  // {id=114.0, name=New King James Version, abbr=NKJV}, 
  // {name=New Living Translation, abbr=NLT, id=116.0}, 
  // {name=Revised Standard Version, id=2020.0, abbr=RSV}, 
  ];
  return versionArr;

   // First try loading from cache
  const cache = CacheService.getScriptCache();
  const uniqueId = `${langId}-versions`;
  const versionsStr = cache.get(uniqueId);
  if (versionsStr != null) {
    Logger.log("Loaded cached version list");
    return JSON.parse(versionsStr);
  }

  const url = `https://www.bible.com/json/bible/versions/${langId}/`;
  const json = UrlFetchApp.fetch(url).getContentText();
  const data = JSON.parse(json);
  
  for (let item of data.items) {
    const abbr = item.local_abbreviation;
    const name = item.local_title;
    const id = item.id;
    //Logger.log(`abbr: ${abbr}, name: ${name}, id: ${id}`);
    versionArr.push({abbr, name, id});
  }
 
  cache.put(uniqueId, JSON.stringify(versionArr), 21600);
  return versionArr;
}

function getVersionName(versionId) {
  const versionArr = getVersionList();
  for (let version of versionArr) {
    if (version.id == versionId)
      return version.name;
  }
}

function isFirstChapter(versionId, bookId, chapterId) {
  const chapterArr = getChapterList(versionId, bookId);
  const retVal = chapterId == chapterArr[0].id;
  return retVal;
}

function isLastChapter(versionId, bookId, chapterId) {
  const chapterArr = getChapterList(versionId, bookId);
  const retVal = chapterId == chapterArr[chapterArr.length-1].id;
  return retVal;
}