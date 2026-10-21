const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAppContext } = require('./context');

describe('Bible.com live chapter fetching & parsing', { timeout: 30000 }, () => {
  const chaptersToTest = [
    { id: 'LEV.25', name: 'Leviticus 25 (reported user issue)' },
    { id: 'JER.30', name: 'Jeremiah 30 (testAddChapter default)' },
    { id: 'JHN.1', name: 'John 1 (Gospel with prose and poetry)' },
    { id: 'PSA.23', name: 'Psalm 23 (Poetry & bkPSA)' },
    { id: '2JN.1', name: '2 John 1 (Single-chapter epistle)' },
    { id: 'REV.22', name: 'Revelation 22 (Final chapter of Bible)' },
  ];

  for (const { id, name } of chaptersToTest) {
    it(`successfully extracts and validates XML for ${name}`, async () => {
      let fetchedUrl = '';
      let cachedCalls = [];

      // Create context with real fetch implementation
      const ctx = createAppContext({
        UrlFetchApp: {
          fetch: (url) => {
            fetchedUrl = url;
            // Use synchronous or cached fetch via deasync/child_process or direct fetch in test
            // Since UrlFetchApp.fetch is synchronous in Apps Script, we mock it below with fetched content
            return {
              getContentText: () => currentFetchedHtml,
            };
          },
        },
      });

      // Perform real HTTP fetch
      const url = `https://www.bible.com/bible/59/${id}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        },
      });
      assert.strictEqual(res.ok, true, `HTTP request to ${url} failed with status ${res.status}`);
      const currentFetchedHtml = await res.text();

      // Run getChapterXml
      const xml = ctx.getChapterXml(59, id);

      // Verify non-empty output
      assert.ok(xml, `getChapterXml returned empty string for ${id}`);
      assert.ok(xml.length > 500, `Extracted XML for ${id} is unexpectedly short (${xml.length} bytes)`);

      // Verify starts with a book div
      assert.match(xml, /<div class="[^"]*?book[^"]*">/, `XML does not start with book div for ${id}`);

      // Verify ends with closed div hierarchy
      assert.match(xml, /(?:<\/div>\s*){3}$/, `XML does not end with 3 closed div tags for ${id}`);

      // Verify no invalid &nbsp; entities remain
      assert.strictEqual(/&nbsp;/i.test(xml), false, `Found unencoded &nbsp; entity in XML for ${id}`);

      // Verify chapter content exists inside
      assert.ok(xml.includes(`data-usfm="${id}"`), `XML missing data-usfm="${id}" attribute`);
      assert.ok(xml.includes(`data-usfm="${id}.1"`), `XML missing first verse attribute data-usfm="${id}.1"`);
    });
  }
});
