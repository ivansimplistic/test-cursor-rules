// USAGE: 
// run this command in the terminal `node validate-theme.js`
//
// Example to exclude parts of a file from validation:
// HTML:   <!-- validation-disable:checkConsoleDebug --> ... <!-- validation-enable:checkConsoleDebug -->
// CSS/JS: /* validation-disable:checkConsoleDebug */ ... /* validation-enable:checkConsoleDebug */
// Liquid: {% comment %}validation-disable:checkConsoleDebug{% endcomment %} ... {% comment %}validation-enable:checkConsoleDebug{% endcomment %}
//
// Example to disable all checks in part of a file:
// <!-- validation-disable:all --> or /* validation-disable:all */ or {% comment %}validation-disable:all{% endcomment %}
//
// To disable checks in a file use FILE_IGNORES 


// CONFIGURATION: Enable/disable checks here
const CONFIG = {
  checkHardcodedText: { enabled: true },
  checkHexColors: { enabled: false },
  checkFontFamily: { enabled: true }, // look for hardcoded font-family usage
  checkConsoleDebug: { enabled: true },
  checkCssClassNaming: { enabled: true },
  checkInlineStyles: { enabled: false },
  checkJsonCustomCss: { enabled: true },
};

// Patterns automatically ignored by checkHardcodedText:
// - URLs and paths (/, //, ./, ../, http://, https://)
// - CSS selectors (.class, #id)
// - Data attributes (data-*)
// - File paths with extensions (.js, .css, .png, etc.)
// - Technical assignments (location=, .href=, querySelector, etc.)
// - Schema blocks ({% schema %} ... {% endschema %})

// Post-config: define font-family allowlists for readability and quick toggling
CONFIG.checkFontFamily.allowedFontKeywords = [
  'inherit',
  'initial',
  'unset',
  'revert',
  'revert-layer',
];

CONFIG.checkFontFamily.allowedGenericFamilies = [
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
];

// Project-approved custom fonts (add here as needed)
CONFIG.checkFontFamily.allowedCustomFonts = [
  // Icon fonts / third-party
  'Linearicons-Free',
  // Theme custom monogram fonts
  'Round_Monogram_Right',
  'Round_Monogram_Left',
  'Round_Monogram_Center',
];

// FILE-BASED IGNORES: Specify file patterns to ignore specific checks
// Format: { 'glob_pattern': ['checkType1', 'checkType2'] } or { 'glob_pattern': 'all' }
const FILE_IGNORES = {
  // Examples:
  // 'assets/ai_*.js.liquid': ['checkConsoleDebug'], // Ignore console.debug checks in AI-related JS files
  // 'snippets/photoswipe.liquid': ['checkCssClassNaming'], // Ignore CSS class naming in PhotoSwipe (3rd party)
  // 'assets/vendor/**/*': 'all', // Ignore all checks in vendor files
  //Test files: temporary comment to enable checks on test files
  'sections/test-hardcoded-text.liquid': ['checkHardcodedText'],
  //Theme files
  'assets/photoswipe.css': ['checkCssClassNaming'],
  'sections/promo_review_helper.liquid': ['checkHardcodedText'],
  'sections/color_swatches.liquid': ['checkHardcodedText']
};

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SNIPPETS_DIR = path.join(ROOT, 'snippets');
const SECTIONS_DIR = path.join(ROOT, 'sections');
const ASSETS_DIR = path.join(ROOT, 'assets');
const TEMPLATES_DIR = path.join(ROOT, 'templates');

// Regex for code-based ignores
const HTML_DISABLE_REGEX = /<!--\s*validation-disable:([a-zA-Z,]+|all)\s*-->/;
const HTML_ENABLE_REGEX = /<!--\s*validation-enable:([a-zA-Z,]+|all)\s*-->/;
const CSS_JS_DISABLE_REGEX = /\/\*\s*validation-disable:([a-zA-Z,]+|all)\s*\*\//;
const CSS_JS_ENABLE_REGEX = /\/\*\s*validation-enable:([a-zA-Z,]+|all)\s*\*\//;
const LIQUID_DISABLE_REGEX = /\{%\s*comment\s*%\}\s*validation-disable:([a-zA-Z,]+|all)\s*\{%\s*endcomment\s*%\}/;
const LIQUID_ENABLE_REGEX = /\{%\s*comment\s*%\}\s*validation-enable:([a-zA-Z,]+|all)\s*\{%\s*endcomment\s*%\}/;

const HEX_COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b/;
const FONT_FAMILY_REGEX = /font-family\s*:\s*([^;\n]+);/;
const CONSOLE_DEBUG_REGEX = /\b(console\.(log|debug)|debugger)\b/;
const CSS_CLASS_REGEX = /class\s*=\s*"([^"]+)"/g;
const CLASS_NAME_FORMAT = /^(?:(large|medium|small|medium-down|medium-up)--)?[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INLINE_STYLE_REGEX = /\bstyle\s*=\s*"([^"]*)"/g;
const ALLOWED_INLINE_STYLE = /^\s*display\s*:\s*none\s*;?\s*$/i;
const LIQUID_VAR_REGEX = /\{\{.*?\}\}|\{%.+?%\}/;
const CSS_VAR_REGEX = /var\(--[a-zA-Z0-9-_]+\)/;
const HARD_CODED_TEXT_REGEX = />([^<>{}\[\]\n\r]+)</g;
const TRANSLATION_TAG_REGEX = /\{\{\s*t\s+['"][^'"]+['"]\s*\}\}/;
const HTML_ATTR_TEXT = /\b(alt|title|placeholder|aria-label|data-[a-z-]+)\s*=\s*['"][^'"]+['"]/;
const LIQUID_TAG_OR_EXPR_REGEX = /^(\{%-?\s*.*?\s*-?%\}|\{\{-?\s*.*?\s*-?\}\})$/;
const CSS_CLASS_NAMES_REGEX = /(^|[^_])_([^_]|$)/;
const LIQUID_ONLY_REGEX = /^\s*\{\{.*\}\}\s*$/;
const CSS_VAR_ONLY_REGEX = /^\s*var\(--[a-zA-Z0-9-_]+\)\s*;?\s*$/;
const LIQUID_PLUS_UNIT_REGEX = /^\s*\{\{.*\}\}\s*(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)?\s*;?\s*$/i;

let errors = 0;

// Error counters for each check type
const errorCounts = {
  hardcodedText: 0,
  hexColors: 0,
  fontFamily: 0,
  consoleDebug: 0,
  cssClassNaming: 0,
  inlineStyles: 0,
  jsonCustomCss: 0,
};

// Centralized messages and emitter to avoid duplication in logs
const MESSAGES = {
  hardcodedText: (rel, idx, text) => `[checkHardcodedText] Error: Text [${text}] must be moved to locales/en.default.json in ${rel}:${idx + 1}`,
  hexColors: (rel, idx, value) => `[checkHexColors] Error: Hardcoded hex color in ${rel}:${idx + 1}: ${String(value).trim()}`,
  fontFamily: (rel, idx, value) => `[checkFontFamily] Error: Hardcoded font family in ${rel}:${idx + 1}: ${String(value).trim()}`,
  inlineStyles: (rel, idx, value) => `[checkInlineStyles] Error: Inline style not allowed in ${rel}:${idx + 1}: style="${String(value)}"`,
  cssClassNaming: (rel, idx, cls) => `[checkCssClassNaming] Error: CSS class name with underscore '${cls}' in ${rel}:${idx + 1}`,
  consoleDebug: (rel, idx, value) => `[checkConsoleDebug] Error: Debugging statement in ${rel}:${idx + 1}: ${String(value).trim()}`,
  jsonInvalid: (rel) => `[checkJsonCustomCss] Error: Invalid JSON in ${rel}:1`,
  jsonHex: (rel, idx) => `[checkJsonCustomCss] Error: Hardcoded hex color in custom_css in ${rel}:${(idx ?? 0) + 1}`,
  jsonFontFamily: (rel, value, idx) => `[checkJsonCustomCss] Error: Hardcoded font family in custom_css in ${rel}:${(idx ?? 0) + 1}: ${String(value).trim()}`,
};

function emitError(typeKey, rel, idx, payload) {
  errors++;
  if (errorCounts.hasOwnProperty(typeKey)) {
    errorCounts[typeKey]++;
  }
  const msgBuilder = MESSAGES[typeKey];
  if (typeof msgBuilder === 'function') {
    console.error(msgBuilder(rel, idx, payload));
  } else if (typeof payload === 'string') {
    console.error(payload);
  }
}

// Build allowlists from CONFIG (normalize to lowercase for comparisons)
const ALLOWED_FONT_KEYWORDS = new Set((CONFIG.checkFontFamily.allowedFontKeywords || []).map(s => s.toLowerCase()));
const ALLOWED_GENERIC_FAMILIES = new Set((CONFIG.checkFontFamily.allowedGenericFamilies || []).map(s => s.toLowerCase()));
const ALLOWED_CUSTOM_FONTS = new Set((CONFIG.checkFontFamily.allowedCustomFonts || []).map(s => s.toLowerCase()));

function stripQuotes(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitFontFamilyList(value) {
  // Split on commas that are not inside quotes
  const parts = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }
    if (ch === ',' && !inSingle && !inDouble) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

function normalizeFamilyName(name) {
  return stripQuotes(name).trim().toLowerCase();
}

function isAllowedFontToken(token) {
  const name = normalizeFamilyName(token);
  if (name === '') return true;
  if (name.includes('var(')) return true;
  if (name.includes('{{') || name.includes('{%')) return true;
  if (ALLOWED_FONT_KEYWORDS.has(name)) return true;
  if (ALLOWED_GENERIC_FAMILIES.has(name)) return true;
  if (ALLOWED_CUSTOM_FONTS.has(name)) return true;
  return false;
}

function findFirstDisallowedFont(tokens) {
  for (const token of tokens) {
    if (!isAllowedFontToken(token)) return token;
  }
  return null;
}

function isAllowedFontFamilyValue(value) {
  const val = String(value || '').trim();
  if (val === '') return true;
  // If any CSS var or Liquid is present, allow
  if (val.includes('var(') || val.includes('{{') || val.includes('{%')) return true;
  const tokens = splitFontFamilyList(val);
  return findFirstDisallowedFont(tokens) === null;
}

// --- Scanners (shared) ---
function scanHexColor(line) {
  if (!HEX_COLOR_REGEX.test(line)) return null;
  if (CSS_VAR_REGEX.test(line)) return null;
  if (LIQUID_VAR_REGEX.test(line)) return null;
  return line.trim();
}

function scanFontFamily(line) {
  const match = FONT_FAMILY_REGEX.exec(line);
  if (!match) return null;
  const value = match[1];
  if (isAllowedFontFamilyValue(value)) return null;
  return value.trim();
}

function scanCssClassNamingFromCssLine(staticCssLine) {
  const offenders = [];
  const classSelectorRegex = /\.(\w[\w-]*)/g;
  let classMatch;
  while ((classMatch = classSelectorRegex.exec(staticCssLine)) !== null) {
    const cls = classMatch[1];
    if (CSS_CLASS_NAMES_REGEX.test(cls)) {
      offenders.push(cls);
    }
  }
  return offenders;
}

// Simple glob matcher: supports '*' (any chars except /), '**' (any chars), '?' (single char)
function globMatch(str, pattern) {
  // Escape regex special chars except for * and ?
  let regex = pattern.replace(/([.+^=!:${}()|\[\]\/\\])/g, '\\$1');
  regex = regex.replace(/\*\*/g, '___GLOBSTAR___');
  regex = regex.replace(/\*/g, '[^/]*');
  regex = regex.replace(/___GLOBSTAR___/g, '.*');
  regex = regex.replace(/\?/g, '.');
  return new RegExp('^' + regex + '$').test(str);
}

function shouldIgnoreCheck(filePath, checkType) {
  const rel = path.relative(ROOT, filePath).split(path.sep).join('/');
  for (const pattern in FILE_IGNORES) {
    if (globMatch(rel, pattern)) {
      const ignoredChecks = FILE_IGNORES[pattern];
      if (ignoredChecks === 'all' || (Array.isArray(ignoredChecks) && ignoredChecks.includes(checkType))) {
        return true;
      }
    }
  }
  return false;
}

// Track disabled checks for code-based ignores
function updateDisabledChecks(line, disabledChecks) {
  // Check for disable comments (HTML, CSS/JS, or Liquid)
  let match = HTML_DISABLE_REGEX.exec(line) || 
              CSS_JS_DISABLE_REGEX.exec(line) ||
              LIQUID_DISABLE_REGEX.exec(line);
  if (match) {
    const types = match[1];
    if (types === 'all') {
      Object.keys(CONFIG).forEach(check => disabledChecks[check] = true);
    } else {
      types.split(',').forEach(type => {
        const checkType = type.trim();
        if (checkType.startsWith('check')) {
          disabledChecks[checkType] = true;
        } else {
          disabledChecks[`check${checkType.charAt(0).toUpperCase()}${checkType.slice(1)}`] = true;
        }
      });
    }
  }
  
  // Check for enable comments (HTML, CSS/JS, or Liquid)
  match = HTML_ENABLE_REGEX.exec(line) || 
          CSS_JS_ENABLE_REGEX.exec(line) ||
          LIQUID_ENABLE_REGEX.exec(line);
  if (match) {
    const types = match[1];
    if (types === 'all') {
      Object.keys(disabledChecks).forEach(check => delete disabledChecks[check]);
    } else {
      types.split(',').forEach(type => {
        const checkType = type.trim();
        if (checkType.startsWith('check')) {
          delete disabledChecks[checkType];
        } else {
          delete disabledChecks[`check${checkType.charAt(0).toUpperCase()}${checkType.slice(1)}`];
        }
      });
    }
  }
  
  return disabledChecks;
}

function walkDir(dir, cb) {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules') walkDir(filePath, cb);
    } else {
      cb(filePath);
    }
  });
}

function checkFile(file) {
  const ext = path.extname(file);
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  if (file.startsWith(SNIPPETS_DIR) || file.startsWith(SECTIONS_DIR)) {
    if (ext === '.liquid') checkLiquidFile(file, rel);
  } else if (file.startsWith(ASSETS_DIR)) {
    if (ext === '.css' || ext === '.liquid' && file.endsWith('.css.liquid')) checkCssFile(file, rel);
    if (ext === '.js' || ext === '.liquid' && file.endsWith('.js.liquid')) checkJsFile(file, rel);
  } else if (file.startsWith(TEMPLATES_DIR) && ext === '.json') {
    checkJsonFile(file, rel);
  }
}

function checkLiquidFile(file, rel) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let inCommentBlock = false;
  let inMultilineLiquid = false;
  let inSchemaBlock = false; // Track schema blocks
  let disabledChecks = {};
  
  lines.forEach((line, idx) => {
    // Update disabled checks based on comments in the line
    disabledChecks = updateDisabledChecks(line, disabledChecks);
    
    // Track schema blocks
    if (line.includes('{% schema %}')) inSchemaBlock = true;
    if (inSchemaBlock && line.includes('{% endschema %}')) inSchemaBlock = false;
    
    // Skip lines inside {% comment %} ... {% endcomment %}
    if (line.includes('{% comment %}')) inCommentBlock = true;
    if (inCommentBlock) {
      if (line.includes('{% endcomment %}')) inCommentBlock = false;
      return;
    }
    
    // Track multi-line Liquid tags/expressions
    if (!inMultilineLiquid) {
      // Start of a multi-line Liquid tag
      if ((line.includes('{%') && !line.includes('%}')) || (line.includes('{{') && !line.includes('}}'))) {
        inMultilineLiquid = true;
      }
    } else {
      // End of a multi-line Liquid tag
      if (line.includes('%}') || line.includes('}}')) {
        inMultilineLiquid = false;
      }
      return; // skip all checks while inside multi-line Liquid
    }

    // Console debugging
    if (CONFIG.checkConsoleDebug && !disabledChecks.checkConsoleDebug && !shouldIgnoreCheck(file, 'checkConsoleDebug') && 
        CONSOLE_DEBUG_REGEX.test(line)) {
      emitError('consoleDebug', rel, idx, line);
    }

    // Hardcoded text
    if (CONFIG.checkHardcodedText.enabled && !disabledChecks.checkHardcodedText && !shouldIgnoreCheck(file, 'checkHardcodedText') && !inSchemaBlock) {
      let match;
      while ((match = HARD_CODED_TEXT_REGEX.exec(line)) !== null) {
        const text = match[1].trim();
        if (
          text &&
          !LIQUID_VAR_REGEX.test(text) &&
          !TRANSLATION_TAG_REGEX.test(line) &&
          !HTML_ATTR_TEXT.test(line) &&
          !isCodeDelimiterText(text) &&
          !isTechnicalString(text, line) && // Check if technical string
          // Additional check: ignore if line contains complex Liquid filters
          !(line.includes('| replace:') || line.includes('| split:') || line.includes('| append:') || line.includes('| strip_html') || line.includes('| truncatewords'))
        ) {
          emitError('hardcodedText', rel, idx, text);
        }
      }
    }
    
    // Hex colors
    if (CONFIG.checkHexColors.enabled && !disabledChecks.checkHexColors && !shouldIgnoreCheck(file, 'checkHexColors')) {
      const hexIssue = scanHexColor(line);
      if (hexIssue) {
      emitError('hexColors', rel, idx, hexIssue);
      }
    }
    
    // Font family
    if (CONFIG.checkFontFamily.enabled && !disabledChecks.checkFontFamily && !shouldIgnoreCheck(file, 'checkFontFamily')) {
      const ffIssue = scanFontFamily(line);
      if (ffIssue) emitError('fontFamily', rel, idx, ffIssue);
    }
    
    // Inline styles
    if (CONFIG.checkInlineStyles.enabled && !disabledChecks.checkInlineStyles && !shouldIgnoreCheck(file, 'checkInlineStyles')) {
      let styleMatch;
      while ((styleMatch = INLINE_STYLE_REGEX.exec(line)) !== null) {
        const styleValue = styleMatch[1];
        if (isAllowedInlineStyleValue(styleValue)) {
          continue;
        }
        emitError('inlineStyles', rel, idx, styleValue);
      }
    }
    
    // CSS class naming
    if (CONFIG.checkCssClassNaming.enabled && !disabledChecks.checkCssClassNaming && !shouldIgnoreCheck(file, 'checkCssClassNaming')) {
      let classMatch;
      while ((classMatch = CSS_CLASS_REGEX.exec(line)) !== null) {
        const classAttrValue = classMatch[1];
        // If the whole class attribute value is a Liquid tag/expression, skip
        if (LIQUID_TAG_OR_EXPR_REGEX.test(classAttrValue.trim())) continue;
        // Split into static and dynamic (Liquid) parts
        // This regex matches {% ... %} or {{ ... }} blocks
        const staticParts = classAttrValue.split(/\{%-?[^%]*-?%\}|\{\{-?[^}]*-?\}\}/g);
        // Track already reported class names for this line
        const reported = new Set();
        staticParts.forEach(part => {
          part.split(/\s+/).forEach(cls => {
            if (cls === '' || cls === '-' || cls === '--') return;
            // Ignore if the class name contains Liquid delimiters or a dot (variable reference)
            if (cls.includes('{') || cls.includes('}') || cls.includes('.')) return;
            // Only flag if the class name matches the regex and hasn't been reported for this line
            if (CSS_CLASS_NAMES_REGEX.test(cls) && !reported.has(cls)) {
              reported.add(cls);
              emitError('cssClassNaming', rel, idx, cls);
            }
          });
        });
      }
    }
  });
}

function checkCssFile(file, rel) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let disabledChecks = {};
  
  lines.forEach((line, idx) => {
    // Update disabled checks based on comments in the line
    disabledChecks = updateDisabledChecks(line, disabledChecks);
    
    // Remove all Liquid tags ({{ ... }} and {% ... %}) from the line
    const staticLine = line.replace(/\{%-?[^%]*-?%\}|\{\{-?[^}]*-?\}\}/g, '');
    
    // Hex colors
    if (CONFIG.checkHexColors.enabled && !disabledChecks.checkHexColors && !shouldIgnoreCheck(file, 'checkHexColors')) {
      const hexIssue = scanHexColor(line);
      if (hexIssue) {
      emitError('hexColors', rel, idx, hexIssue);
      }
    }
    
    // Font family
    if (CONFIG.checkFontFamily.enabled && !disabledChecks.checkFontFamily && !shouldIgnoreCheck(file, 'checkFontFamily')) {
      const ffIssue = scanFontFamily(line);
      if (ffIssue) emitError('fontFamily', rel, idx, ffIssue);
    }
    
    // CSS class naming
    if (CONFIG.checkCssClassNaming.enabled && !disabledChecks.checkCssClassNaming && !shouldIgnoreCheck(file, 'checkCssClassNaming')) {
      const offenders = Array.from(new Set(scanCssClassNamingFromCssLine(staticLine)));
      if (offenders.length) offenders.forEach(cls => emitError('cssClassNaming', rel, idx, cls));      
    }
  });
}

function checkJsFile(file, rel) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let disabledChecks = {};
  
  lines.forEach((line, idx) => {
    // Update disabled checks based on comments in the line
    disabledChecks = updateDisabledChecks(line, disabledChecks);
    
    if (CONFIG.checkConsoleDebug && !disabledChecks.checkConsoleDebug && !shouldIgnoreCheck(file, 'checkConsoleDebug') && 
        CONSOLE_DEBUG_REGEX.test(line)) {
      emitError('consoleDebug', rel, idx, line);
    }
  });
}

function checkJsonFile(file, rel) {
  if (!CONFIG.checkJsonCustomCss.enabled || shouldIgnoreCheck(file, 'checkJsonCustomCss')) return;
  
  let json;
  const raw = fs.readFileSync(file, 'utf8');
  try {
    const cleanedContent = stripJsonCommentsSafe(raw);
    json = JSON.parse(cleanedContent);
  } catch (e) {
    emitError('jsonInvalid', rel, 0);
    return;
  }

  // Recursively scan for any nested `custom_css` string fields
  function computeLineIndexFromPos(text, pos) {
    if (typeof pos !== 'number' || pos < 0) return 0;
    let line = 0;
    for (let i = 0; i < pos; i++) {
      if (text[i] === '\n') line++;
    }
    return line;
  }

  const searchState = { from: 0 };

  function findNextCustomCssKeyLine() {
    const key = '"custom_css"';
    const pos = raw.indexOf(key, searchState.from);
    if (pos === -1) return 0;
    searchState.from = pos + key.length;
    return computeLineIndexFromPos(raw, pos);
  }

  function scanObjectForCustomCss(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(scanObjectForCustomCss);
      return;
    }
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (key === 'custom_css' && typeof value === 'string') {
        const css = value;
        const lineIdx = findNextCustomCssKeyLine();
        if (HEX_COLOR_REGEX.test(css)) {
          emitError('jsonCustomCss', rel, lineIdx, MESSAGES.jsonHex(rel, lineIdx));
        }
        const fontMatch = FONT_FAMILY_REGEX.exec(css);
        if (fontMatch && !isAllowedFontFamilyValue(fontMatch[1])) {
          emitError('jsonCustomCss', rel, lineIdx, MESSAGES.jsonFontFamily(rel, fontMatch[1], lineIdx));
        }
      } else if (value && typeof value === 'object') {
        scanObjectForCustomCss(value);
      }
    }
  }

  scanObjectForCustomCss(json);
}

function isTechnicalString(text, line) {
  const trimmed = text.trim();
  
  // Empty or very short
  if (trimmed.length === 0 || trimmed.length === 1) return true;
  
  // URL patterns
  if (/^(https?:)?\/\//.test(trimmed)) return true; // http://, https://, //
  if (/^[\/\?#]/.test(trimmed)) return true; // starts with /, ?, #
  if (/^\.{1,2}\//.test(trimmed)) return true; // ./ or ../
  
  // CSS selectors
  if (/^[.#][\w-]+$/.test(trimmed)) return true; // .class or #id
  if (/^[\w-]+\[[\w-]+/.test(trimmed)) return true; // element[attr
  
  // Data attributes (technical identifiers only)
  if (/^data-[\w-]+$/.test(trimmed)) return true; // data-*
  
  // NOTE: aria-label, aria-description contain customer-facing text - don't ignore
  // Other aria-* are typically technical (aria-expanded, aria-controls, etc.)
  
  // File paths and extensions
  if (/\.(js|css|json|liquid|svg|png|jpg|gif|woff|woff2)$/i.test(trimmed)) return true;
  
  // Mathematical and logical expressions (Liquid conditions)
  if (/^\d+\.?\d*\s+(and|or|&&|\|\|)\s+[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true; // "1.2 and r"
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s+(and|or|&&|\|\|)\s+\d+\.?\d*$/.test(trimmed)) return true; // "r and 1.2"
  if (/^\d+\.?\d*\s*[<>=!]+\s*\d+\.?\d*$/.test(trimmed)) return true; // "1.2 < 2"
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*[<>=!]+\s*\d+\.?\d*$/.test(trimmed)) return true; // "r > 1.2"
  if (/^\d+\.?\d*\s*[<>=!]+\s*[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true; // "1.2 < r"
  
  // Additional mathematical patterns
  if (/^\d+\.?\d*\s*[+\-*/]\s*\d+\.?\d*$/.test(trimmed)) return true; // "1.2 + 2.3"
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s*[+\-*/]\s*\d+\.?\d*$/.test(trimmed)) return true; // "r + 1.2"
  if (/^\d+\.?\d*\s*[+\-*/]\s*[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true; // "1.2 + r"
  
  // Complex logical expressions
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\s+(and|or|&&|\|\|)\s+[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true; // "r and s"
  if (/^\d+\.?\d*\s*[<>=!]+\s*\d+\.?\d*\s+(and|or|&&|\|\|)\s+[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) return true; // "1.2 < 2 and r"
  
  // Context: Check if line contains technical assignments
  if (line.includes('location') && line.includes('=')) return true;
  if (line.includes('.href') && line.includes('=')) return true;
  if (line.includes('querySelector')) return true;
  if (line.includes('getElementById')) return true;
  if (line.includes('classList.')) return true;
  if (line.includes('dataset.')) return true;
  if (line.includes('fetch(')) return true;
  if (line.includes('endpoint')) return true;
  if (line.includes('route') && line.includes('=')) return true;
  if (line.includes('path') && line.includes('=')) return true;
  
  return false;
}

function isCodeDelimiterText(text) {
  // Ignore if text is only punctuation, whitespace, or common delimiters
  if (/^[\s,|:;*\-\/]+$/.test(text)) return true;
  // Ignore if text is less than 3 alphanumeric characters and not a word
  if (/^[^a-zA-Z0-9]*[a-zA-Z0-9][^a-zA-Z0-9]*$/.test(text) && text.length < 3) return true;

  // Ignore Liquid filter fragments and pipe operators
  if (/^['"]\s*\|\s*[^'"]*['"]?\s*\|?\s*(replace|strip_html|truncatewords|split|append|prepend)\s*:?\s*['"]?/.test(text)) return true;
  
  // Ignore complex Liquid filter chains
  if (/\|\s*(replace|strip_html|truncatewords|split|append|prepend)\s*:/.test(text)) return true;
  
  // Ignore JavaScript function calls in quotes
  if (/^[a-zA-Z_][a-zA-Z0-9_]*\(\)/.test(text)) return true;
  
  // Ignore comparison operators and logical expressions
  if (/^[<>=!&|]+\s*\d+/.test(text)) return true;
  
  // Ignore HTML entities and special characters
  if (/^&[a-zA-Z]+;/.test(text)) return true;
  
  // Ignore pipe operators and Liquid delimiters
  if (/^['"]\s*[^'"]*\s*\|/.test(text)) return true;
  
  // Ignore only special characters and operators
  if (/^[^a-zA-Z]*[|&<>][^a-zA-Z]*$/.test(text)) return true;
  
  // Ignore specific problematic patterns
  if (/^['"]\s*[^'"]*\s*\|\s*[^'"]*\s*['"]?\s*\|/.test(text)) return true;
  if (/^-\s*['"]\s*\|\s*append/.test(text)) return true;
  if (/^=\s*\d+\s*&&\s*char\.ord/.test(text)) return true;
    
  return false;
}

// Custom algorithm AI generated, not using regex because it can't handle the complexity of JSON.
function stripJsonCommentsSafe(str) {
  let result = "";
  let inString = false;
  let stringChar = null; // " or '
  let inLineComment = false;
  let inBlockComment = false;
  let prevChar = "";

  for (let i = 0; i < str.length; i++) {
    const curr = str[i];
    const next = str[i + 1];

    // Inside a "//" comment: skip until newline
    if (inLineComment) {
      if (curr === "\n") {
        inLineComment = false;
        result += curr; // keep the newline
      }
      continue;
    }

    // Inside a "/* ... */" comment: skip until closing */
    if (inBlockComment) {
      if (curr === "*" && next === "/") {
        inBlockComment = false;
        i++; // skip the "/"
      }
      continue;
    }

    // Detect entering a string (only if not already inside one)
    if (!inString && (curr === '"' || curr === "'")) {
      inString = true;
      stringChar = curr;
      result += curr;
      prevChar = curr;
      continue;
    }

    // Handle characters inside a string
    if (inString) {
      result += curr;

      // Exit string if the quote is not escaped
      if (curr === stringChar && prevChar !== "\\") {
        inString = false;
      }

      prevChar = curr;
      continue;
    }

    // Detect start of a line comment "//"
    if (curr === "/" && next === "/") {
      inLineComment = true;
      i++; // skip second "/"
      continue;
    }

    // Detect start of a block comment "/*"
    if (curr === "/" && next === "*") {
      inBlockComment = true;
      i++; // skip "*"
      continue;
    }

    // Normal character (not in string and not a comment)
    result += curr;
    prevChar = curr;
  }

  return result;
}

function isAllowedInlineStyleValue(value) {
  value = value.trim().replace(/;$/, '');
  const props = value.split(';').map(s => s.trim()).filter(Boolean);
  if (props.length === 0) return true;
  for (const prop of props) {
    const [name, ...rest] = prop.split(':');
    if (!rest.length) continue;
    const propName = name.trim();
    const val = rest.join(':').trim();
    // Allow any display property
    if (/^display$/i.test(propName)) continue;
    // Allow any CSS variable assignment
    if (/^--[a-zA-Z0-9-_]+$/.test(propName)) continue;
    // Allow if the value is a Liquid tag or a CSS variable
    if (LIQUID_ONLY_REGEX.test(val) || CSS_VAR_ONLY_REGEX.test(val)) continue;
    // Allow if the value is a Liquid tag plus optional CSS unit
    if (LIQUID_PLUS_UNIT_REGEX.test(val)) continue;
    // Allow if the value is a sequence of CSS variables and/or Liquid tags
    if (/^(\s*(var\(--[a-zA-Z0-9-_]+\)|\{\{.*?\}\}))*\s*;?\s*$/.test(val)) continue;
    return false;
  }
  return true;
}

// Main walk
walkDir(ROOT, checkFile);

if (errors === 0) {
  console.log('Validation completed! No errors found.');
} else {
  console.log(`Found ${errors} error(s).`);
  console.log('Error summary by type:');
  Object.entries(errorCounts).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`- ${type}: ${count}`);
    }
  });
  process.exit(2);
} 