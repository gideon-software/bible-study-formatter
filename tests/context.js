const fs = require('fs');
const vm = require('vm');
const path = require('path');

/**
 * Creates an isolated V8 execution context simulating the Google Apps Script environment.
 * Loads Bible.js, BibleParser.js, and Bsf.js.
 */
function createAppContext(overrides = {}) {
  const context = {
    Logger: {
      log: () => {},
    },
    CacheService: {
      getScriptCache: () => ({
        get: () => null,
        put: () => {},
      }),
      getUserCache: () => ({
        get: () => null,
        put: () => {},
      }),
    },
    UrlFetchApp: {
      fetch: () => ({
        getContentText: () => '',
      }),
    },
    GssEmail: {
      sendDeveloperEmail: () => {},
    },
    GssSheet: {
      logEntry: () => {},
      logUniqueEntry: () => false,
    },
    DocumentApp: {
      HorizontalAlignment: {
        CENTER: 'CENTER',
        RIGHT: 'RIGHT',
      },
      Attribute: {
        HORIZONTAL_ALIGNMENT: 'HORIZONTAL_ALIGNMENT',
        FONT_SIZE: 'FONT_SIZE',
        BOLD: 'BOLD',
        ITALIC: 'ITALIC',
      },
      TextAlignment: {
        SUPERSCRIPT: 'SUPERSCRIPT',
      },
    },
    XmlService: {
      parse: () => {},
    },
    ...overrides,
  };

  vm.createContext(context);

  const rootDir = path.resolve(__dirname, '..');
  const bibleCode = fs.readFileSync(path.join(rootDir, 'Bible.js'), 'utf8');
  const parserCode = fs.readFileSync(path.join(rootDir, 'BibleParser.js'), 'utf8');
  const bsfCode = fs.readFileSync(path.join(rootDir, 'Bsf.js'), 'utf8');

  vm.runInContext(bibleCode, context);
  vm.runInContext(parserCode, context);
  vm.runInContext(bsfCode, context);

  return context;
}

module.exports = {
  createAppContext,
};
