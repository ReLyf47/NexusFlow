// scripts/verify_contrast.js
// Automated WCAG 2.1 Contrast Ratio Verification for NexusFlow Design Tokens

function hexToRgb(hex) {
  const cleanHex = hex.replace('#', '');
  const bigint = parseInt(cleanHex, 16);
  return [
    (bigint >> 16) & 255,
    (bigint >> 8) & 255,
    bigint & 255
  ];
}

function getLuminance([r, g, b]) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrast(hex1, hex2) {
  const l1 = getLuminance(hexToRgb(hex1));
  const l2 = getLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const lightPairs = [
  { name: 'Light Mode: Text Main (#0A0A0C) on Canvas (#F4F3EE)', fg: '#0A0A0C', bg: '#F4F3EE', type: 'body' },
  { name: 'Light Mode: Text Main (#0A0A0C) on Surface (#FFFFFF)', fg: '#0A0A0C', bg: '#FFFFFF', type: 'body' },
  { name: 'Light Mode: Text Sub (#3E404C) on Surface (#FFFFFF)', fg: '#3E404C', bg: '#FFFFFF', type: 'body' },
  { name: 'Light Mode: Text Sub (#3E404C) on Elevated (#FAF9F5)', fg: '#3E404C', bg: '#FAF9F5', type: 'body' },
  { name: 'Light Mode: Text Muted (#646675) on Surface (#FFFFFF)', fg: '#646675', bg: '#FFFFFF', type: 'caption' },
  // Accent text uses the --ink-* tokens; neon hues are only ever fills behind #0A0A0C text
  ...[['Pink', '#C8005A'], ['Cyan', '#00737A'], ['Mint', '#00704F'], ['Orange', '#A64B00'], ['Yellow', '#7A6200'], ['Purple', '#7928CA']].flatMap(([n, c]) =>
    [['Surface', '#FFFFFF'], ['Elevated', '#FAF9F5'], ['Canvas', '#F4F3EE']].map(([bn, bg]) => ({ name: `Light Mode: Ink ${n} (${c}) on ${bn} (${bg})`, fg: c, bg, type: 'body' }))
  ),
  { name: 'Light Mode: Sticker text (#0A0A0C) on chrome band (#94A3B8)', fg: '#0A0A0C', bg: '#94A3B8', type: 'badge' },
  { name: 'Light Mode: Button text (#0A0A0C) on Hazard Pink (#FF1A75)', fg: '#0A0A0C', bg: '#FF1A75', type: 'badge' },
  { name: 'Light Mode: Accent Badge text (#0A0A0C) on Mint (#00E5A3)', fg: '#0A0A0C', bg: '#00E5A3', type: 'badge' },
  { name: 'Light Mode: Accent Badge text (#0A0A0C) on Yellow (#FFE600)', fg: '#0A0A0C', bg: '#FFE600', type: 'badge' },
];

const darkPairs = [
  { name: 'Dark Mode: Text Main (#F4F4F6) on Canvas (#07080C)', fg: '#F4F4F6', bg: '#07080C', type: 'body' },
  { name: 'Dark Mode: Text Main (#F4F4F6) on Surface (#0E1017)', fg: '#F4F4F6', bg: '#0E1017', type: 'body' },
  { name: 'Dark Mode: Text Sub (#B5B8C8) on Surface (#0E1017)', fg: '#B5B8C8', bg: '#0E1017', type: 'body' },
  { name: 'Dark Mode: Text Sub (#B5B8C8) on Elevated (#151824)', fg: '#B5B8C8', bg: '#151824', type: 'body' },
  { name: 'Dark Mode: Text Muted (#82869A) on Surface (#0E1017)', fg: '#82869A', bg: '#0E1017', type: 'caption' },
  ...[['Pink', '#FF1A75'], ['Cyan', '#00F0FF'], ['Mint', '#00E5A3'], ['Orange', '#FF8A00'], ['Yellow', '#FFE600'], ['Purple', '#B98CFF']].flatMap(([n, c]) =>
    [['Surface', '#0E1017'], ['Elevated', '#151824'], ['Canvas', '#07080C']].map(([bn, bg]) => ({ name: `Dark Mode: Ink ${n} (${c}) on ${bn} (${bg})`, fg: c, bg, type: 'body' }))
  ),
  { name: 'Dark Mode: Accent Badge text (#0A0A0C) on Cyan (#00F0FF)', fg: '#0A0A0C', bg: '#00F0FF', type: 'badge' },
  { name: 'Dark Mode: Accent Badge text (#0A0A0C) on Mint (#00E5A3)', fg: '#0A0A0C', bg: '#00E5A3', type: 'badge' },
];

console.log('====================================================');
console.log('  WCAG 2.1 AUTOMATED CONTRAST VERIFICATION REPORT');
console.log('====================================================\n');

let allPassed = true;

function evaluatePairs(pairs, mode) {
  console.log(`--- ${mode.toUpperCase()} ---`);
  pairs.forEach((p) => {
    const ratio = getContrast(p.fg, p.bg);
    const minRequired = p.type === 'caption' || p.type === 'large' ? 3.0 : 4.5;
    const isAAA = ratio >= 7.0;
    const isAA = ratio >= minRequired;

    if (!isAA) allPassed = false;

    const rating = isAAA ? 'PASS (AAA)' : isAA ? 'PASS (AA)' : 'FAIL';
    console.log(`[${rating}] ${p.name}`);
    console.log(`       Contrast Ratio: ${ratio.toFixed(2)}:1 (Min required: ${minRequired}:1)\n`);
  });
}

evaluatePairs(lightPairs, 'Light Mode');
evaluatePairs(darkPairs, 'Dark Mode');

console.log('====================================================');
if (allPassed) {
  console.log('✅ ALL TEXT / BACKGROUND PAIRS PASS WCAG AA / AAA STANDARDS!');
} else {
  console.log('❌ SOME PAIRS FAILED WCAG STANDARDS!');
  process.exit(1);
}
console.log('====================================================');
