/**
 * tests/contrast.test.js
 * Reads the theme token blocks from assets/css/styles.css and asserts
 * WCAG 2.1 contrast ratios for both light (whiteboard) and dark (chalkboard)
 * themes, plus all five accent options.
 *
 * Normal text: >= 4.5:1
 * Large text and UI borders / icons: >= 3.0:1
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = join(__dirname, '..', 'assets', 'css', 'styles.css');
const css = readFileSync(cssPath, 'utf8');

function extractThemeTokens(themeName) {
  const re = new RegExp(`:root\\[data-theme=['"]${themeName}['"]\\]\\s*\\{([\\s\\S]*?)\\}`, 'm');
  const match = css.match(re);
  assert.ok(match, `Missing :root[data-theme='${themeName}'] block in styles.css`);
  const block = match[1];
  const tokens = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens[`--${m[1]}`] = m[2].trim();
  }
  return tokens;
}

function hexToRgb(hex) {
  const clean = hex.trim().replace(/^#/, '');
  assert.match(clean, /^[0-9a-fA-F]{6}$/, `Expected 6-digit hex color, got ${hex}`);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const ACCENT_TOKENS = ['--acc-red', '--acc-periwinkle', '--acc-green', '--acc-teal', '--acc-orange'];

for (const theme of ['light', 'dark']) {
  test(`WCAG contrast ratios for ${theme} theme`, () => {
    const t = extractThemeTokens(theme);
    const defaultAccent = t['--acc-red'];
    assert.ok(defaultAccent, `${theme}: missing --acc-red`);

    const normalTextPairs = [
      ['text / bg', t['--text'], t['--bg'], 4.5],
      ['text / surface-1', t['--text'], t['--surface-1'], 4.5],
      ['text / surface-2', t['--text'], t['--surface-2'], 4.5],
      ['text / surface-3', t['--text'], t['--surface-3'], 4.5],
      ['text-muted / surface-1', t['--text-muted'], t['--surface-1'], 4.5],
      ['text-muted / surface-2', t['--text-muted'], t['--surface-2'], 4.5],
      ['on-accent / default accent', t['--on-accent'], defaultAccent, 4.5]
    ];

    for (const [label, fg, bg, min] of normalTextPairs) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(
        ratio >= min,
        `${theme} (${label}): ${fg} on ${bg} is ${ratio.toFixed(2)}:1, expected >= ${min}:1`
      );
    }

    const uiAndStatusPairs = [
      ['default accent / surface-1', defaultAccent, t['--surface-1'], 3.0],
      ['success / surface-1', t['--success'], t['--surface-1'], 3.0],
      ['warning / surface-1', t['--warning'], t['--surface-1'], 3.0],
      ['danger / surface-1', t['--danger'], t['--surface-1'], 3.0],
      ['border-strong (UI controls) / surface-1', t['--border-strong'], t['--surface-1'], 3.0],
      ['border-strong (UI controls) / surface-2', t['--border-strong'], t['--surface-2'], 3.0],
      ['border-strong (UI controls) / surface-3', t['--border-strong'], t['--surface-3'], 3.0]
    ];

    for (const [label, fg, bg, min] of uiAndStatusPairs) {
      const ratio = contrastRatio(fg, bg);
      assert.ok(
        ratio >= min,
        `${theme} (${label}): ${fg} on ${bg} is ${ratio.toFixed(2)}:1, expected >= ${min}:1`
      );
    }

    for (const accKey of ACCENT_TOKENS) {
      const acc = t[accKey];
      assert.ok(acc, `${theme}: missing ${accKey}`);
      const onAccRatio = contrastRatio(t['--on-accent'], acc);
      assert.ok(
        onAccRatio >= 4.5,
        `${theme} (on-accent / ${accKey}): ${t['--on-accent']} on ${acc} is ${onAccRatio.toFixed(2)}:1, expected >= 4.5:1`
      );
      const surfRatio = contrastRatio(acc, t['--surface-1']);
      assert.ok(
        surfRatio >= 3.0,
        `${theme} (${accKey} / surface-1): ${acc} on ${t['--surface-1']} is ${surfRatio.toFixed(2)}:1, expected >= 3.0:1`
      );
    }
  });
}

test('No hardcoded hex colors outside the :root[data-theme] token blocks', () => {
  const stripped = css.replace(/:root\[data-theme=['"](?:light|dark)['"]\]\s*\{[\s\S]*?\}/gm, '');
  const strayHex = stripped.match(/#[0-9a-fA-F]{3,8}\b/g);
  assert.equal(strayHex, null, `Found hardcoded hex color(s) outside theme blocks: ${strayHex}`);
});

test('Component tokens use color-mix() in both themes', () => {
  for (const theme of ['light', 'dark']) {
    const t = extractThemeTokens(theme);
    for (const name of ['--hero-rings', '--ornament', '--stamp-border', '--ledger-line']) {
      assert.ok(t[name] && t[name].includes('color-mix('), `${theme} ${name} must use color-mix()`);
    }
  }
});
