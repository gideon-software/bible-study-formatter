const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createAppContext } = require('./context');

describe('Bible.js functions', () => {
  const ctx = createAppContext();

  it('getBookList returns 66 canonical books', () => {
    const list = ctx.getBookList(59);
    assert.strictEqual(Array.isArray(list), true);
    assert.strictEqual(list.length, 66);
    assert.strictEqual(list[0].id, 'GEN');
    assert.strictEqual(list[0].name, 'Genesis');
    assert.strictEqual(list[0].numChapters, 50);
    assert.strictEqual(list[list.length - 1].id, 'REV');
    assert.strictEqual(list[list.length - 1].name, 'Revelation');
    assert.strictEqual(list[list.length - 1].numChapters, 22);
  });

  it('getBookName returns correct book name by id', () => {
    assert.strictEqual(ctx.getBookName(59, 'GEN'), 'Genesis');
    assert.strictEqual(ctx.getBookName(59, 'LEV'), 'Leviticus');
    assert.strictEqual(ctx.getBookName(59, 'PSA'), 'Psalms');
    assert.strictEqual(ctx.getBookName(59, 'JHN'), 'John');
    assert.strictEqual(ctx.getBookName(59, 'REV'), 'Revelation');
    assert.strictEqual(ctx.getBookName(59, 'NONEXISTENT'), undefined);
  });

  it('getChapterList returns correctly formatted list', () => {
    const levChapters = ctx.getChapterList(59, 'LEV');
    assert.strictEqual(levChapters.length, 27);
    assert.strictEqual(levChapters[0].num, 1);
    assert.strictEqual(levChapters[0].id, 'LEV.1');
    assert.strictEqual(levChapters[24].num, 25);
    assert.strictEqual(levChapters[24].id, 'LEV.25');
    assert.strictEqual(levChapters[26].num, 27);
    assert.strictEqual(levChapters[26].id, 'LEV.27');

    const singleChapterBook = ctx.getChapterList(59, '2JN');
    assert.strictEqual(singleChapterBook.length, 1);
    assert.strictEqual(singleChapterBook[0].num, 1);
    assert.strictEqual(singleChapterBook[0].id, '2JN.1');
  });

  it('getChapterName extracts chapter number from chapter id', () => {
    assert.strictEqual(ctx.getChapterName(59, 'LEV', 'LEV.25'), 25);
    assert.strictEqual(ctx.getChapterName(59, 'GEN', 'GEN.1'), 1);
    assert.strictEqual(ctx.getChapterName(59, 'PSA', 'PSA.150'), 150);
  });

  it('isFirstChapter correctly identifies first chapter', () => {
    assert.strictEqual(ctx.isFirstChapter(59, 'LEV', 'LEV.1'), true);
    assert.strictEqual(ctx.isFirstChapter(59, 'LEV', 'LEV.2'), false);
    assert.strictEqual(ctx.isFirstChapter(59, 'LEV', 'LEV.25'), false);
  });

  it('isLastChapter correctly identifies last chapter', () => {
    assert.strictEqual(ctx.isLastChapter(59, 'LEV', 'LEV.27'), true);
    assert.strictEqual(ctx.isLastChapter(59, 'LEV', 'LEV.25'), false);
    assert.strictEqual(ctx.isLastChapter(59, 'LEV', 'LEV.1'), false);
    // Single chapter book
    assert.strictEqual(ctx.isLastChapter(59, '2JN', '2JN.1'), true);
  });

  it('getVersionAbbr returns correct abbreviation', () => {
    assert.strictEqual(ctx.getVersionAbbr(59), 'ESV');
    assert.strictEqual(ctx.getVersionAbbr(99999), undefined);
  });

  it('getVersionList contains default supported versions', () => {
    const versions = ctx.getVersionList();
    assert.strictEqual(Array.isArray(versions), true);
    const esv = versions.find(v => v.id === 59);
    assert.ok(esv);
    assert.strictEqual(esv.abbr, 'ESV');
  });
});
