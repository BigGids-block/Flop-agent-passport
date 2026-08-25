import { PASSPORT_W, renderInto, shortenDid, shortenUrl } from './passport.js';

const $ = (selector) => document.querySelector(selector);
const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;

const fields = {
  contributor: $('#contributor'), role: $('#role'), title: $('#title'),
  description: $('#description'), type: $('#type'), url: $('#url'),
  did: $('#did'), room: $('#room'), sequence: $('#sequence'), date: $('#date'),
};
const ui = {
  canvas: $('#passport-canvas'), frame: $('.passport-frame'), status: $('#lookup-status'),
  didError: $('#did-error'), records: $('#records'), recordsList: $('#records-list'),
  recordsHeading: $('#records-heading'), verdict: $('#verdict'), verdictLabel: $('#verdict-label'),
  verdictNote: $('#verdict-note'), feedback: $('#feedback'),
};

/* lookup mirrors what the Technocore endpoint last told us about one DID. */
let lookup = { state: 'idle', did: '', data: null };
let lookupTimer = null;
let frameRequest = null;

const VERDICTS = {
  verified: { label: 'Verified & recorded', note: 'This link appears in a public message signed by your DID.' },
  signed: { label: 'DID confirmed', note: 'Your DID has public signed activity, but this link is not in it yet. The contribution stays self-declared.' },
  declared: { label: 'Self-declared', note: 'Nothing has been matched to a public Technocore record yet.' },
  unavailable: { label: 'Unverified', note: 'The Technocore lookup could not be reached, so nothing was checked.' },
  checking: { label: 'Checking Technocore…', note: 'Reading public signed messages in lobby and technocore.' },
};

function value(key) {
  return (fields[key]?.value || '').trim();
}

function numberFromDid(did) {
  let hash = 0;
  for (const char of did) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return String((hash % 9999) + 1).padStart(4, '0');
}

function formatDate(input) {
  if (!input) return '';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T00:00:00` : input);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(date).toUpperCase().replace(/,/g, '');
}

function isoDate(input) {
  if (!input) return '';
  const date = new Date(input);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

/* Two links point at the same thing if host and path agree; tracking params don't count. */
function normalizeUrl(url) {
  return String(url || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^www\./, '')
    .split(/[?#]/)[0].replace(/\/+$/, '');
}

function matchedRecord() {
  const url = normalizeUrl(value('url'));
  if (!url || lookup.state !== 'ok' || !lookup.data?.records) return null;
  return lookup.data.records.find((record) =>
    (record.urls || []).some((candidate) => normalizeUrl(candidate) === url)) || null;
}

function verification() {
  const did = value('did');
  if (!did || !DID_PATTERN.test(did)) return { level: 'declared', verdict: 'declared' };
  if (lookup.state === 'loading') return { level: 'declared', verdict: 'checking' };
  if (lookup.state === 'error') return { level: 'unavailable', verdict: 'unavailable' };
  if (lookup.state !== 'ok' || lookup.did !== did) return { level: 'declared', verdict: 'declared' };
  const record = matchedRecord();
  if (record) return { level: 'verified', verdict: 'verified', record };
  if (lookup.data.signedCount > 0) return { level: 'signed', verdict: 'signed' };
  return { level: 'declared', verdict: 'declared' };
}

/* On a verified card every record value comes from the matched message.
   On any other card it comes from the form, and the band says so. */
function recordLine(state) {
  const parts = [];
  if (state.level === 'verified') {
    const record = state.record;
    parts.push('PUBLIC RECORD', `/${record.room}`);
    if (record.seq !== null && record.seq !== undefined) parts.push(`#${record.seq}`);
    const date = formatDate(record.ts);
    if (date) parts.push(date);
    return parts.join('  \u00b7  ');
  }
  parts.push(state.level === 'unavailable' ? 'NOT CHECKED' : 'SELF-ENTERED');
  const room = value('room');
  if (room) parts.push(`/${room}`);
  const sequence = value('sequence').replace(/^#/, '');
  if (sequence) parts.push(`#${sequence}`);
  const date = formatDate(value('date'));
  if (date) parts.push(date);
  return parts.join('  \u00b7  ');
}

function passportData() {
  const state = verification();
  const did = value('did');
  const untouched = !value('title') && !value('description');
  return {
    contributor: value('contributor') || 'Your name here',
    role: value('role') || 'CONTRIBUTOR',
    title: value('title') || 'What you made',
    description: value('description') || (untouched ? 'A short line about what you made and why it matters.' : ''),
    type: value('type') || 'OTHER',
    url: value('url'),
    did,
    serial: DID_PATTERN.test(did) ? numberFromDid(did) : '',
    level: state.level,
    recordLine: recordLine(state),
    _state: state,
  };
}

function altText(data) {
  return [
    `Technocore proof of contribution for ${data.contributor}, role ${data.role}.`,
    `Contribution: ${data.title}.`, data.description,
    `Status: ${VERDICTS[data._state.verdict].label}. ${data.recordLine}.`,
    data.did ? `DID ${shortenDid(data.did)}.` : '',
  ].filter(Boolean).join(' ');
}

function paint() {
  frameRequest = null;
  const data = passportData();
  const width = ui.frame.clientWidth || 640;
  renderInto(ui.canvas, data, width, Math.min(window.devicePixelRatio || 1, 3));
  ui.canvas.style.width = '100%';
  ui.canvas.setAttribute('aria-label', altText(data));

  const verdict = VERDICTS[data._state.verdict];
  ui.verdict.dataset.level = data._state.verdict;
  ui.verdictLabel.textContent = verdict.label;
  ui.verdictNote.textContent = verdict.note;
  return data;
}

function render() {
  if (frameRequest) return;
  frameRequest = requestAnimationFrame(paint);
}

/* When a real record backs the card, mirror its values into the form so the
   inputs never disagree with what is printed. */
function syncRecordFields() {
  const state = verification();
  const locked = state.level === 'verified';
  if (locked) {
    const record = state.record;
    if (fields.room.querySelector(`option[value="${record.room}"]`)) fields.room.value = record.room;
    fields.sequence.value = record.seq === null || record.seq === undefined ? '' : String(record.seq);
    const iso = isoDate(record.ts);
    if (iso) fields.date.value = iso;
  }
  for (const key of ['room', 'sequence', 'date']) {
    const field = fields[key];
    field.toggleAttribute('readonly', locked && key !== 'room');
    field.toggleAttribute('disabled', locked && key === 'room');
    field.closest('.field')?.toggleAttribute('data-locked', locked);
  }
}

function setStatus(text) {
  ui.status.textContent = text;
}

function drawRecords() {
  const data = lookup.data;
  if (lookup.state !== 'ok' || !data) { ui.records.hidden = true; return; }
  const records = data.records || [];
  if (!records.length) {
    ui.records.hidden = false;
    ui.recordsHeading.textContent = data.signedCount
      ? 'This DID has signed messages, but no public links in /technocore yet.'
      : 'No public signed activity found for this DID.';
    ui.recordsList.replaceChildren();
    return;
  }
  ui.records.hidden = false;
  ui.recordsHeading.textContent = `Tap a public record to attach it${records.length > 1 ? ` (${records.length} found)` : ''}`;
  const current = normalizeUrl(value('url'));
  ui.recordsList.replaceChildren(...records.map((record) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'record';
    const url = record.urls?.[0] || '';
    if (current && normalizeUrl(url) === current) button.dataset.active = 'true';
    const meta = [record.seq !== null && record.seq !== undefined ? `#${record.seq}` : `/${record.room}`, formatDate(record.ts)].filter(Boolean).join(' · ');
    button.innerHTML = `<b>${shortenUrl(url, 40)}</b><i>${meta}</i>`;
    button.addEventListener('click', () => {
      fields.url.value = url;
      syncRecordFields();
      drawRecords();
      render();
      ui.feedback.textContent = 'Record attached — the card is now verified.';
    });
    return button;
  }));
}

async function loadActivity(did) {
  lookup = { state: 'loading', did, data: null };
  setStatus('CHECKING…');
  ui.records.hidden = true;
  render();
  try {
    const response = await fetch(`/api/activity?did=${encodeURIComponent(did)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Lookup returned ${response.status}.`);
    const data = await response.json();
    if (value('did') !== did) return;
    lookup = { state: 'ok', did, data };
    setStatus(data.contributionCount ? `${data.contributionCount} PUBLIC RECORD${data.contributionCount === 1 ? '' : 'S'}` : data.signedCount ? 'SIGNED ACTIVITY' : 'NO ACTIVITY');
  } catch {
    if (value('did') !== did) return;
    lookup = { state: 'error', did, data: null };
    setStatus('LOOKUP UNAVAILABLE');
  } finally {
    if (value('did') === did) { drawRecords(); syncRecordFields(); render(); }
  }
}

function handleDidInput() {
  clearTimeout(lookupTimer);
  const did = value('did');
  lookup = { state: 'idle', did: '', data: null };
  ui.records.hidden = true;
  syncRecordFields();
  if (!did) { ui.didError.textContent = ''; setStatus('PASTE A DID'); render(); return; }
  if (!DID_PATTERN.test(did)) {
    ui.didError.textContent = 'That is not a complete Technocore did:key yet.';
    setStatus('INCOMPLETE DID');
    render();
    return;
  }
  ui.didError.textContent = '';
  render();
  lookupTimer = setTimeout(() => loadActivity(did), 550);
}

function bindCounter(field, output, max) {
  const update = () => { output.textContent = `${field.value.length}/${max}`; };
  field.addEventListener('input', update);
  update();
}

for (const [key, field] of Object.entries(fields)) {
  if (key === 'did') continue;
  field.addEventListener('input', () => { if (key === 'url') { syncRecordFields(); drawRecords(); } render(); });
  field.addEventListener('change', render);
}
fields.did.addEventListener('input', handleDidInput);
bindCounter(fields.title, $('#title-count'), 60);
bindCounter(fields.description, $('#description-count'), 180);

$('#passport-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const did = value('did');
  if (!DID_PATTERN.test(did)) {
    ui.didError.textContent = 'Enter a full Technocore did:key to check the record.';
    fields.did.focus();
    return;
  }
  ui.didError.textContent = '';
  loadActivity(did);
});

/* Export uses the same renderer at 2x, so the file matches the preview exactly. */
async function passportPng() {
  if (document.fonts?.ready) { try { await document.fonts.ready; } catch { /* fall back to system fonts */ } }
  const canvas = document.createElement('canvas');
  renderInto(canvas, passportData(), PASSPORT_W, 2);
  return canvas;
}

function fileName() {
  const slug = (value('title') || value('contributor') || 'contribution')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `technocore-proof-${slug || 'contribution'}.png`;
}

$('#download').addEventListener('click', async () => {
  ui.feedback.textContent = 'Rendering…';
  try {
    const canvas = await passportPng();
    const link = document.createElement('a');
    link.download = fileName();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob) {
      link.href = URL.createObjectURL(blob);
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    } else {
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
    ui.feedback.textContent = 'Downloaded — ready to post.';
  } catch {
    ui.feedback.textContent = 'The image could not be rendered in this browser.';
  }
});

function shareText() {
  const data = passportData();
  const lines = [
    '✦ PROOF OF CONTRIBUTION',
    '',
    `${data.contributor.toUpperCase()} · ${data.role}`,
    data.title,
  ];
  if (data.description) lines.push('', data.description);
  lines.push('', data._state.level === 'verified' ? `Recorded on ${data.recordLine.replace(/\s+·\s+/g, ' · ')}` : 'Self-declared contribution — not yet matched to a public record.');
  if (data.did) lines.push(shortenDid(data.did));
  return lines.join('\n');
}

$('#share').addEventListener('click', async () => {
  const text = shareText();
  try {
    const canvas = await passportPng();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = blob ? new File([blob], fileName(), { type: 'image/png' }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
    if (navigator.share) { await navigator.share({ title: 'Proof of Contribution', text }); return; }
    await navigator.clipboard.writeText(text);
    ui.feedback.textContent = 'Share text copied — attach the PNG to your post.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    try {
      await navigator.clipboard.writeText(text);
      ui.feedback.textContent = 'Share text copied — attach the PNG to your post.';
    } catch {
      ui.feedback.textContent = 'Sharing is unavailable in this browser.';
    }
  }
});

if (!fields.date.value) fields.date.value = new Date().toISOString().slice(0, 10);
if (window.ResizeObserver) new ResizeObserver(render).observe(ui.frame);
else window.addEventListener('resize', render);
if (document.fonts?.ready) document.fonts.ready.then(render).catch(() => {});
render();
