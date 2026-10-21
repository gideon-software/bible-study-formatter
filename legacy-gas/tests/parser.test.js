const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const { createAppContext } = require('./context');

describe('BibleParser.js functions', () => {
  const ctx = createAppContext();

  describe('getFirstWord', () => {
    it('handles modern scoped hash format (cat7xG_<class>)', () => {
      assert.strictEqual(ctx.getFirstWord('cat7xG_book'), 'book');
      assert.strictEqual(ctx.getFirstWord('cat7xG_chapter'), 'chapter');
      assert.strictEqual(ctx.getFirstWord('cat7xG_p'), 'p');
      assert.strictEqual(ctx.getFirstWord('cat7xG_verse'), 'verse');
      assert.strictEqual(ctx.getFirstWord('cat7xG_label'), 'label');
      assert.strictEqual(ctx.getFirstWord('cat7xG_content'), 'content');
      assert.strictEqual(ctx.getFirstWord('cat7xG_s1'), 's1');
      assert.strictEqual(ctx.getFirstWord('cat7xG_nd'), 'nd');
      assert.strictEqual(ctx.getFirstWord('cat7xG_wj'), 'wj');
      assert.strictEqual(ctx.getFirstWord('cat7xG_q1'), 'q1');
      assert.strictEqual(ctx.getFirstWord('cat7xG_q2'), 'q2');
      assert.strictEqual(ctx.getFirstWord('cat7xG_qr'), 'qr');
      assert.strictEqual(ctx.getFirstWord('cat7xG_sc'), 'sc');
      assert.strictEqual(ctx.getFirstWord('cat7xG_bkPSA'), 'bkPSA');
    });

    it('handles multi-class attribute values', () => {
      assert.strictEqual(ctx.getFirstWord('cat7xG_note cat7xG_x'), 'note');
      assert.strictEqual(ctx.getFirstWord('cat7xG_book cat7xG_bkPSA'), 'book');
    });

    it('handles intermediate Next.js module format', () => {
      assert.strictEqual(ctx.getFirstWord('ChapterContent-module__cat7xG__q1'), 'q1');
      assert.strictEqual(ctx.getFirstWord('ChapterContent-module__abc123__book'), 'book');
      assert.strictEqual(ctx.getFirstWord('ChapterContent-module__xyz__verse'), 'verse');
    });

    it('handles legacy ChapterContent_ format', () => {
      assert.strictEqual(ctx.getFirstWord('ChapterContent_book'), 'book');
      assert.strictEqual(ctx.getFirstWord('ChapterContent_p'), 'p');
      assert.strictEqual(ctx.getFirstWord('ChapterContent_q1'), 'q1');
    });

    it('preserves plain class names without prefix', () => {
      assert.strictEqual(ctx.getFirstWord('ref'), 'ref');
      assert.strictEqual(ctx.getFirstWord('xta'), 'xta');
      assert.strictEqual(ctx.getFirstWord('ft'), 'ft');
      assert.strictEqual(ctx.getFirstWord('version vid59 iso6393eng'), 'version');
    });

    it('handles edge cases safely without throwing', () => {
      assert.strictEqual(ctx.getFirstWord(''), '');
      assert.strictEqual(ctx.getFirstWord(null), '');
      assert.strictEqual(ctx.getFirstWord(undefined), '');
    });
  });

  describe('Punctuation rules', () => {
    it('PUNCT includes closing punctuation and excludes opening parenthesis', () => {
      const punct = vm.runInContext('PUNCT', ctx);
      assert.ok(punct.has('.'));
      assert.ok(punct.has(','));
      assert.ok(punct.has(':'));
      assert.ok(punct.has(';'));
      assert.ok(punct.has('?'));
      assert.ok(punct.has('!'));
      assert.ok(punct.has(')'));
      assert.ok(punct.has("'"));
      assert.strictEqual(punct.has('('), false);
      assert.strictEqual(punct.has('"'), false);
    });
  });
});
