function test2() {
  testAddChapter();
}

function getBookList(versionId) {
  return [
    { name: "Genesis", id: "GEN", numChapters: 50 },
    { name: "Exodus", id: "EXO", numChapters: 40 },
    { name: "Leviticus", id: "LEV", numChapters: 27 },
    { name: "Numbers", id: "NUM", numChapters: 36 },
    { name: "Deuteronomy", id: "DEU", numChapters: 34 },
    { name: "Joshua", id: "JOS", numChapters: 24 },
    { name: "Judges", id: "JDG", numChapters: 21 },
    { name: "Ruth", id: "RUT", numChapters: 4 },
    { name: "1 Samuel", id: "1SA", numChapters: 31 },
    { name: "2 Samuel", id: "2SA", numChapters: 24 },
    { name: "1 Kings", id: "1KI", numChapters: 22 },
    { name: "2 Kings", id: "2KI", numChapters: 25 },
    { name: "1 Chronicles", id: "1CH", numChapters: 29 },
    { name: "2 Chronicles", id: "2CH", numChapters: 36 },
    { name: "Ezra", id: "EZR", numChapters: 10 },
    { name: "Nehemiah", id: "NEH", numChapters: 13 },
    { name: "Esther", id: "EST", numChapters: 10 },
    { name: "Job", id: "JOB", numChapters: 42 },
    { name: "Psalms", id: "PSA", numChapters: 150 },
    { name: "Proverbs", id: "PRO", numChapters: 31 },
    { name: "Ecclesiastes", id: "ECC", numChapters: 12 },
    { name: "Song of Solomon", id: "SNG", numChapters: 8 },
    { name: "Isaiah", id: "ISA", numChapters: 66 },
    { name: "Jeremiah", id: "JER", numChapters: 52 },
    { name: "Lamentations", id: "LAM", numChapters: 5 },
    { name: "Ezekiel", id: "EZK", numChapters: 48 },
    { name: "Daniel", id: "DAN", numChapters: 12 },
    { name: "Hosea", id: "HOS", numChapters: 14 },
    { name: "Joel", id: "JOL", numChapters: 3 },
    { name: "Amos", id: "AMO", numChapters: 9 },
    { name: "Obadiah", id: "OBA", numChapters: 1 },
    { name: "Jonah", id: "JON", numChapters: 4 },
    { name: "Micah", id: "MIC", numChapters: 7 },
    { name: "Nahum", id: "NAM", numChapters: 3 },
    { name: "Habakkuk", id: "HAB", numChapters: 3 },
    { name: "Zephaniah", id: "ZEP", numChapters: 3 },
    { name: "Haggai", id: "HAG", numChapters: 2 },
    { name: "Zechariah", id: "ZEC", numChapters: 14 },
    { name: "Malachi", id: "MAL", numChapters: 4 },
    { name: "Matthew", id: "MAT", numChapters: 28 },
    { name: "Mark", id: "MRK", numChapters: 16 },
    { name: "Luke", id: "LUK", numChapters: 24 },
    { name: "John", id: "JHN", numChapters: 21 },
    { name: "Acts", id: "ACT", numChapters: 28 },
    { name: "Romans", id: "ROM", numChapters: 16 },
    { name: "1 Corinthians", id: "1CO", numChapters: 16 },
    { name: "2 Corinthians", id: "2CO", numChapters: 13 },
    { name: "Galatians", id: "GAL", numChapters: 6 },
    { name: "Ephesians", id: "EPH", numChapters: 6 },
    { name: "Philippians", id: "PHP", numChapters: 4 },
    { name: "Colossians", id: "COL", numChapters: 4 },
    { name: "1 Thessalonians", id: "1TH", numChapters: 5 },
    { name: "2 Thessalonians", id: "2TH", numChapters: 3 },
    { name: "1 Timothy", id: "1TI", numChapters: 6 },
    { name: "2 Timothy", id: "2TI", numChapters: 4 },
    { name: "Titus", id: "TIT", numChapters: 3 },
    { name: "Philemon", id: "PHM", numChapters: 1 },
    { name: "Hebrews", id: "HEB", numChapters: 13 },
    { name: "James", id: "JAS", numChapters: 5 },
    { name: "1 Peter", id: "1PE", numChapters: 5 },
    { name: "2 Peter", id: "2PE", numChapters: 3 },
    { name: "1 John", id: "1JN", numChapters: 5 },
    { name: "2 John", id: "2JN", numChapters: 1 },
    { name: "3 John", id: "3JN", numChapters: 1 },
    { name: "Jude", id: "JUD", numChapters: 1 },
    { name: "Revelation", id: "REV", numChapters: 22 }
  ];
}

function getBookName(versionId, bookId) {
  const bookList = getBookList(versionId);
  for (let book of bookList) {
    if (book.id == bookId)
      return book.name;
  }
}

function getChapterList(versionId, bookId) {
  let chapterArr = [];
  const bookList = getBookList(versionId);

  for (let book of bookList) {
    if (book.id == bookId) {
      for (let i = 0; i < book.numChapters; i++) {
        const num = i + 1;
        const id = `${book.id}.${num}`;
        chapterArr.push({ num, id });
      }
      return chapterArr;
    }
  }
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
  if (cachedXml) {
    Logger.log("Loading chapter XML from cache...");
    return cachedXml;
  }

  // No cache; load from bible.com
  const srcUrl = `https://www.bible.com/bible/${fullChapterId}`;

  // We can't load the whole page via XmlService.parse(), so we have to get the section we need
  const html = UrlFetchApp.fetch(srcUrl).getContentText();

  //const regex = /.*(<div class="book bk.*<\/div>\s+<\/div>\s+<\/div>)\s+<\/div><\/div><\/div>.*/s; // 
  const regex = /(?<html><div class="ChapterContent_book.*<\/div>\s+<\/div>\s+<\/div>)\s+<\/div><\/div><\/div>/s; // s = dot matches single line

  const match = regex.exec(html);
  if (!match) {
    if (!DEBUG_MODE)
      GssEmail.sendDeveloperEmail("[BSF] Parsing issue", `srcUrl: ${srcUrl}`);
    Logger.log("No HTML match found!");
    return "";
  } else {
    if (DEBUG_MODE) {
      Logger.log(`First 100 chars of match: '${match.groups['html'].slice(0, 99)}'`);
      Logger.log(`Last 100 chars of match: '${match.groups['html'].slice(-100)}'`);
    }
  }

  let xml = match.groups['html'];

  // Avoid invalid &nbsp; entity errors
  // TODO: This is NOT a robust solution. There may be other entities that break stuff?
  // https://stackoverflow.com/questions/21845839/how-to-parse-my-string-to-xml-with-nbsp-elements
  // https://stackoverflow.com/questions/34904606/how-do-you-declare-a-the-nbsp-entity-in-xml-document
  // https://stackoverflow.com/questions/4787700/xml-parsing-error-undefined-entity-special-characters
  // https://stackoverflow.com/a/3805286
  xml = xml.replace(/&nbsp;/ig, "&#160;");

  if (!DEBUG_MODE) {
    try {
      cache.put(fullChapterId, xml, 21600);
    } catch (e) {
      Logger.log("Can't cache xml", e);
    }
  }
  return xml;
}

function getVersionAbbr(versionId) {
  const versionArr = getVersionList();
  for (let version of versionArr) {
    if (version.id == versionId)
      return version.abbr;
  }
}

function getVersionList(langId = "eng") {
  let versionArr = [];

  // Only load known working versions for now
  versionArr = [
    { abbr: "ESV", name: "English Standard Version 2016", id: 59 },
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
    versionArr.push({ abbr, name, id });
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
  const retVal = chapterId == chapterArr[chapterArr.length - 1].id;
  return retVal;
}