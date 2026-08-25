/* Passport renderer.
   One draw function powers both the on-screen preview and the downloaded PNG,
   so the image a person shares is byte-for-byte the layout they approved. */

export const PASSPORT_W = 1600;
export const PASSPORT_H = 1060;

const INK = '#0d0e15';
const ACID = '#d9ff4a';
const BONE = '#f7f4ec';
const SOFT = '#b6b3ac';
const MUTED = '#8b8880';
const HAIRLINE = 'rgba(255,255,255,.13)';

const DISPLAY = 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const SCRIPT = 'Caveat, "Segoe Script", "Bradley Hand", cursive';

/* Verification states. Only a matched public record earns the filled lime band. */
export const LEVELS = {
  verified: { label: 'VERIFIED & RECORDED', tick: true, filled: true },
  signed: { label: 'DID CONFIRMED', tick: true, filled: false },
  declared: { label: 'SELF-DECLARED', tick: false, filled: false },
  unavailable: { label: 'UNVERIFIED', tick: false, filled: false },
};

export function shortenDid(did) {
  if (!did) return '\u2014';
  return did.length > 30 ? `${did.slice(0, 17)}\u2026${did.slice(-8)}` : did;
}

export function shortenUrl(url, max = 34) {
  if (!url) return '\u2014';
  const bare = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
  return bare.length > max ? `${bare.slice(0, max - 1)}\u2026` : bare;
}

export function initialOf(name) {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

/* Letter-spacing is drawn by hand rather than via ctx.letterSpacing so that
   every browser produces the same measurements as the export. */
function trackedWidth(ctx, text, spacing) {
  const chars = [...String(text)];
  if (!chars.length) return 0;
  return chars.reduce((total, char) => total + ctx.measureText(char).width + spacing, 0) - spacing;
}

function tracked(ctx, text, x, y, spacing, align = 'left') {
  const chars = [...String(text)];
  if (!chars.length) return 0;
  const width = trackedWidth(ctx, text, spacing);
  let cursor = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  for (const char of chars) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
  return width;
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (lines.length < maxLines) lines.push(line);
  const overflowed = lines.length === maxLines && words.join(' ') !== lines.join(' ');
  if (overflowed) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}\u2026`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.replace(/[\s,.;:-]+$/, '')}\u2026`;
  }
  return lines;
}

/* Shrink the headline until it fits the space instead of letting it overflow. */
function fitLines(ctx, text, maxWidth, maxLines, sizes, weight, family) {
  for (const size of sizes) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = wrapLines(ctx, text, maxWidth, maxLines + 1);
    if (lines.length <= maxLines) return { size, lines };
  }
  const size = sizes[sizes.length - 1];
  ctx.font = `${weight} ${size}px ${family}`;
  return { size, lines: wrapLines(ctx, text, maxWidth, maxLines) };
}

/* The mark and the tick are drawn as paths, not characters: no font on any
   platform is allowed to turn the two most important glyphs into tofu. */
function drawMark(ctx, cx, cy, radius, color) {
  const k = radius * 0.24;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - radius);
  ctx.quadraticCurveTo(cx + k, cy - k, cx + radius, cy);
  ctx.quadraticCurveTo(cx + k, cy + k, cx, cy + radius);
  ctx.quadraticCurveTo(cx - k, cy + k, cx - radius, cy);
  ctx.quadraticCurveTo(cx - k, cy - k, cx, cy - radius);
  ctx.closePath();
  ctx.fill();
}

function drawTick(ctx, x, centerY, size, color, weight) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x, centerY + size * 0.08);
  ctx.lineTo(x + size * 0.36, centerY + size * 0.44);
  ctx.lineTo(x + size, centerY - size * 0.44);
  ctx.stroke();
  ctx.restore();
  return size;
}

function roundRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function rule(ctx, y, left, right, color = HAIRLINE) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
}

function labelledValue(ctx, label, value, x, labelY, valueY, maxWidth) {
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `500 17px ${MONO}`;
  tracked(ctx, label, x, labelY, 2.4);
  ctx.fillStyle = BONE;
  ctx.font = `400 23px ${MONO}`;
  let text = String(value || '\u2014');
  while (text.length > 1 && ctx.measureText(text).width > maxWidth) text = text.slice(0, -1);
  if (text !== String(value || '\u2014')) text = `${text.slice(0, -1)}\u2026`;
  ctx.fillText(text, x, valueY);
}

/**
 * Draws the passport at a fixed 1600x1060 coordinate space.
 * The caller scales the context; nothing here knows about DPI or download size.
 */
export function drawPassport(ctx, data = {}) {
  const L = 92;
  const R = 1508;
  const level = LEVELS[data.level] || LEVELS.declared;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  /* Ground */
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, PASSPORT_W, PASSPORT_H);

  const glow = ctx.createRadialGradient(1430, -80, 20, 1430, -80, 720);
  glow.addColorStop(0, 'rgba(197,233,89,.42)');
  glow.addColorStop(0.35, 'rgba(197,233,89,.15)');
  glow.addColorStop(1, 'rgba(197,233,89,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, PASSPORT_W, PASSPORT_H);

  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(26, 26, PASSPORT_W - 52, PASSPORT_H - 52);

  /* Masthead */
  drawMark(ctx, L + 12, 101, 12, ACID);
  ctx.fillStyle = BONE;
  ctx.font = `600 25px ${MONO}`;
  tracked(ctx, 'TECHNOCORE', L + 38, 110, 3.4);

  ctx.font = `500 19px ${MONO}`;
  const serial = data.serial ? `No. ${data.serial}` : '';
  let serialWidth = 0;
  if (serial) {
    ctx.fillStyle = SOFT;
    serialWidth = tracked(ctx, serial, R, 110, 2.6, 'right') + 22;
  }
  ctx.fillStyle = MUTED;
  tracked(ctx, 'PROOF OF CONTRIBUTION', R - serialWidth, 110, 2.6, 'right');

  rule(ctx, 150, L, R, 'rgba(255,255,255,.10)');

  /* Who */
  ctx.fillStyle = ACID;
  ctx.beginPath();
  ctx.arc(140, 262, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `700 42px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillText(initialOf(data.contributor), 140, 277);
  ctx.textAlign = 'left';

  ctx.fillStyle = MUTED;
  ctx.font = `500 19px ${MONO}`;
  tracked(ctx, 'CONTRIBUTOR', 222, 224, 2.8);

  const name = fitLines(ctx, data.contributor || 'Unnamed contributor', R - 222, 1, [44, 39, 34, 30], '600', DISPLAY);
  ctx.fillStyle = BONE;
  ctx.font = `600 ${name.size}px ${DISPLAY}`;
  ctx.fillText(name.lines[0] || '', 222, 272);

  const role = (data.role || 'CONTRIBUTOR').toUpperCase();
  ctx.font = `500 18px ${MONO}`;
  const roleWidth = trackedWidth(ctx, role, 2.8);
  ctx.strokeStyle = 'rgba(217,255,74,.45)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, 222, 294, roleWidth + 40, 36, 18);
  ctx.stroke();
  ctx.fillStyle = ACID;
  tracked(ctx, role, 242, 318, 2.8);

  rule(ctx, 378, L, R);

  /* What — the centrepiece */
  ctx.fillStyle = MUTED;
  ctx.font = `500 19px ${MONO}`;
  tracked(ctx, 'CONTRIBUTION', L, 434, 2.8);

  const type = (data.type || 'OTHER').toUpperCase();
  ctx.font = `500 19px ${MONO}`;
  ctx.fillStyle = BONE;
  const typeWidth = tracked(ctx, type, R, 434, 2.8, 'right');
  ctx.fillStyle = MUTED;
  tracked(ctx, 'TYPE', R - typeWidth - 18, 434, 2.8, 'right');

  ctx.font = `400 27px ${DISPLAY}`;
  const hasDescription = wrapLines(ctx, data.description, 1190, 3).length > 0;
  const title = fitLines(
    ctx,
    data.title || 'Untitled contribution',
    R - L,
    2,
    hasDescription ? [76, 68, 60, 53, 46] : [92, 82, 72, 62, 52],
    '600',
    DISPLAY,
  );
  const titleLineHeight = title.size * 1.04;
  const titleHeight = title.lines.length * titleLineHeight;

  ctx.font = `400 27px ${DISPLAY}`;
  const descLines = wrapLines(ctx, data.description, 1190, 3);
  const descHeight = descLines.length * 40;
  const gap = descLines.length ? 34 : 0;

  const regionTop = 468;
  const regionBottom = 774;
  const groupHeight = titleHeight + gap + descHeight;
  const slack = Math.max(0, (regionBottom - regionTop - groupHeight) / 2);
  const top = regionTop + Math.min(slack, 46);

  ctx.fillStyle = BONE;
  ctx.font = `600 ${title.size}px ${DISPLAY}`;
  title.lines.forEach((line, index) => {
    ctx.fillText(line, L, top + title.size * 0.8 + index * titleLineHeight);
  });

  if (descLines.length) {
    ctx.fillStyle = SOFT;
    ctx.font = `400 27px ${DISPLAY}`;
    const descTop = top + titleHeight + gap;
    descLines.forEach((line, index) => {
      ctx.fillText(line, L, descTop + 27 + index * 40);
    });
  }

  /* Proof */
  rule(ctx, 800, L, R, 'rgba(255,255,255,.18)');

  const bandTop = 824;
  const bandHeight = 74;
  if (level.filled) {
    ctx.fillStyle = ACID;
    roundRectPath(ctx, L, bandTop, R - L, bandHeight, 4);
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.26)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, L, bandTop, R - L, bandHeight, 4);
    ctx.stroke();
  }

  const bandBaseline = bandTop + 46;
  let cursor = L + 32;
  if (level.tick) {
    drawTick(ctx, cursor, bandBaseline - 8, 22, level.filled ? INK : ACID, 3);
    cursor += 38;
  }
  ctx.fillStyle = level.filled ? INK : BONE;
  ctx.font = `600 25px ${MONO}`;
  const labelWidth = tracked(ctx, level.label, cursor, bandBaseline, 2.6);

  ctx.fillStyle = level.filled ? 'rgba(13,14,21,.68)' : MUTED;
  ctx.font = `500 18px ${MONO}`;
  const recordLine = data.recordLine || 'NO RECORD ATTACHED';
  let record = recordLine;
  const roomForRecord = R - 32 - (cursor + labelWidth) - 44;
  while (record.length > 4 && trackedWidth(ctx, record, 2.2) > roomForRecord) record = record.slice(0, -1);
  if (record !== recordLine) record = `${record.replace(/[\s\u00b7]+$/, '')}\u2026`;
  tracked(ctx, record, R - 32, bandBaseline, 2.2, 'right');

  /* Identity trail + signature */
  labelledValue(ctx, 'DID', shortenDid(data.did), L, 946, 984, 520);
  labelledValue(ctx, 'PUBLIC PROOF', shortenUrl(data.url), 668, 946, 984, 430);

  const signature = (data.contributor || '').trim();
  if (signature) {
    ctx.fillStyle = ACID;
    ctx.font = `400 46px ${SCRIPT}`;
    ctx.textAlign = 'right';
    let mark = signature;
    while (mark.length > 1 && ctx.measureText(mark).width > 320) mark = mark.slice(0, -1);
    if (mark !== signature) mark = `${mark.slice(0, -1)}\u2026`;
    ctx.fillText(mark, R, 962);
    ctx.textAlign = 'left';
  }
  rule(ctx, 976, R - 330, R, 'rgba(255,255,255,.24)');
  ctx.fillStyle = MUTED;
  ctx.font = `500 16px ${MONO}`;
  tracked(ctx, 'SIGNED BY', R, 1004, 2.4, 'right');

  ctx.restore();
}

/** Sizes a canvas for a given CSS width and draws into it. */
export function renderInto(canvas, data, cssWidth, pixelRatio = 1) {
  const scale = (cssWidth / PASSPORT_W) * pixelRatio;
  canvas.width = Math.round(PASSPORT_W * scale);
  canvas.height = Math.round(PASSPORT_H * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawPassport(ctx, data);
  return canvas;
}
