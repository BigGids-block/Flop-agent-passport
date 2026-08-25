const $ = (selector) => document.querySelector(selector);
const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const fields = { name: $('#name'), role: $('#role'), title: $('#title'), url: $('#contribution-url'), did: $('#did') };
const card = {
  did: $('#card-did'), name: $('#card-name'), role: $('#card-role'), title: $('#card-title'), link: $('#card-link'), avatar: $('#avatar'),
  lookup: $('#lookup-status'), label: $('#verification-label'), message: $('#verification-message'), meta: $('#record-meta'),
  verification: $('#verification'), proofAction: $('#proof-action'),
};
let record = null;
let lookupTimer = null;
let lookupInProgress = false;

function shortenDid(did) { return did && did.length > 26 ? `${did.slice(0, 15)}…${did.slice(-7)}` : 'did:key:—'; }
function shortenUrl(url) { try { const parsed = new URL(url); return `${parsed.host}${parsed.pathname}`.replace(/\/$/, '') || parsed.host; } catch { return url || 'Add a public contribution link'; } }
function titleFromUrl(url) { try { const segment = new URL(url).pathname.split('/').filter(Boolean).at(-1) || ''; return segment.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Your contribution'; } catch { return 'Your contribution'; } }
function validUrl(value) { try { const parsed = new URL(value); return parsed.protocol === 'https:' || parsed.protocol === 'http:'; } catch { return false; } }
function formatDate(timestamp) { const date = new Date(timestamp); return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date).toUpperCase(); }
function setVerification(kind, label, message, meta = '') { card.verification.dataset.state = kind; card.label.textContent = label; card.message.textContent = message; card.meta.textContent = meta; }

function updateCard() {
  const did = fields.did.value.trim(); const url = fields.url.value.trim();
  const name = fields.name.value.trim() || 'Your name'; const role = fields.role.value; const title = fields.title.value.trim() || titleFromUrl(url);
  card.did.textContent = shortenDid(did); card.name.textContent = name; card.role.textContent = role; card.title.textContent = title; card.link.textContent = shortenUrl(url);
  card.avatar.textContent = name === 'Your name' ? '?' : name.charAt(0).toUpperCase();
  card.proofAction.hidden = !validUrl(url); if (validUrl(url)) card.proofAction.href = url;
  const validDid = DID_PATTERN.test(did); const hasUrl = validUrl(url);
  if (!did && !url) { card.lookup.textContent = 'ADD YOUR DETAILS'; setVerification('idle', 'NOT YET VERIFIED', 'Add your DID and contribution link to check for a signed Technocore record.'); }
  else if (!validDid || !hasUrl) { card.lookup.textContent = 'CHECK DETAILS'; setVerification('idle', 'NOT YET VERIFIED', 'A full public DID and valid public contribution link are required to verify this passport.'); }
  else if (lookupInProgress) { card.lookup.textContent = 'CHECKING RECORD…'; setVerification('checking', 'CHECKING TECHNOCORE', 'Looking for a signed Technocore record that matches this DID and contribution link.'); }
  else if (record?.did === did && record?.url === url) {
    if (record.verified) { card.lookup.textContent = 'RECORD FOUND'; const proof = record.record; setVerification('verified', 'RECORDED ON TECHNOCORE', 'This DID and contribution link match a signed Technocore contribution record.', `technocore  ·  #${proof.sequence}  ·  ${formatDate(proof.recordedAt)}`); }
    else { card.lookup.textContent = record.lookup || 'NO MATCH FOUND'; setVerification('unverified', 'NOT YET VERIFIED', record.summary || 'No matching signed Technocore contribution record was found.'); }
  } else { card.lookup.textContent = 'READY TO CHECK'; setVerification('idle', 'NOT YET VERIFIED', 'Add your DID and contribution link to check for a signed Technocore record.'); }
}

async function loadRecord(did, url) {
  lookupInProgress = true; record = null; updateCard();
  try {
    const response = await fetch(`/api/activity?${new URLSearchParams({ did, url })}`, { headers: { Accept: 'application/json' } });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error || `Lookup returned ${response.status}.`);
    if (fields.did.value.trim() !== did || fields.url.value.trim() !== url) return; record = { did, url, ...payload };
  } catch {
    if (fields.did.value.trim() !== did || fields.url.value.trim() !== url) return;
    record = { did, url, verified: false, lookup: 'CHECK UNAVAILABLE', summary: 'The record check is temporarily unavailable. Please try again.' };
  } finally { if (fields.did.value.trim() === did && fields.url.value.trim() === url) { lookupInProgress = false; updateCard(); } }
}

function scheduleLookup() {
  clearTimeout(lookupTimer); record = null; lookupInProgress = false; updateCard();
  const did = fields.did.value.trim(); const url = fields.url.value.trim();
  if (!DID_PATTERN.test(did) || !validUrl(url)) return;
  lookupTimer = setTimeout(() => loadRecord(did, url), 450);
}
for (const field of Object.values(fields)) field.addEventListener('input', field === fields.did || field === fields.url ? scheduleLookup : updateCard);
$('#passport-form').addEventListener('submit', (event) => {
  event.preventDefault(); const did = fields.did.value.trim(); const url = fields.url.value.trim();
  $('#did-error').textContent = DID_PATTERN.test(did) ? '' : 'Enter a complete public did:key identifier.';
  $('#url-error').textContent = validUrl(url) ? '' : 'Enter a complete public http(s) contribution link.';
  if (DID_PATTERN.test(did) && validUrl(url)) loadRecord(did, url);
});

function roundedRect(ctx, x, y, width, height) { ctx.beginPath(); ctx.roundRect(x, y, width, height, 0); ctx.stroke(); }
function wrappedText(ctx, text, x, y, maxWidth, lineHeight) { const words = text.split(' '); let line = ''; let row = 0; for (const word of words) { const next = `${line}${word} `; if (ctx.measureText(next).width > maxWidth && line) { ctx.fillText(line.trim(), x, y + row * lineHeight); line = `${word} `; row += 1; } else line = next; } ctx.fillText(line.trim(), x, y + row * lineHeight); }
function passportCanvas() {
  const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1160; const ctx = canvas.getContext('2d'); const green = '#d9ff4a';
  const name = fields.name.value.trim() || 'Your name'; const role = fields.role.value; const did = fields.did.value.trim(); const url = fields.url.value.trim(); const title = fields.title.value.trim() || titleFromUrl(url); const verified = record?.verified && record.did === did && record.url === url;
  ctx.fillStyle = '#101118'; ctx.fillRect(0, 0, canvas.width, canvas.height); const glow = ctx.createRadialGradient(1500, -140, 20, 1500, -140, 700); glow.addColorStop(0, '#c5e959'); glow.addColorStop(.25, 'rgba(197,233,89,.28)'); glow.addColorStop(1, 'rgba(197,233,89,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3; roundedRect(ctx, 28, 28, 1744, 1104);
  ctx.fillStyle = '#f7f4ec'; ctx.font = '600 30px ui-monospace, monospace'; ctx.fillText('✦  TECHNOCORE', 95, 122); ctx.fillStyle = '#bebbb5'; ctx.textAlign = 'right'; ctx.font = '24px ui-monospace, monospace'; ctx.fillText('CONTRIBUTION PASSPORT', 1705, 122); ctx.textAlign = 'left';
  ctx.fillStyle = green; ctx.beginPath(); ctx.arc(150, 310, 64, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#101118'; ctx.textAlign = 'center'; ctx.font = '700 60px Inter, Arial, sans-serif'; ctx.fillText(name === 'Your name' ? '?' : name.charAt(0).toUpperCase(), 150, 332); ctx.textAlign = 'left'; ctx.fillStyle = '#aaa79f'; ctx.font = '20px ui-monospace, monospace'; ctx.fillText('CONTRIBUTOR', 250, 270); ctx.fillStyle = '#f7f4ec'; ctx.font = '700 70px Inter, Arial, sans-serif'; ctx.fillText(name, 250, 345); ctx.font = '700 19px ui-monospace, monospace'; ctx.strokeStyle = '#819d2a'; ctx.lineWidth = 2; roundedRect(ctx, 250, 372, ctx.measureText(role).width + 48, 38); ctx.fillStyle = green; ctx.fillText(role, 274, 398);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(95, 430); ctx.lineTo(1705, 430); ctx.stroke(); ctx.fillStyle = '#aaa79f'; ctx.font = '20px ui-monospace, monospace'; ctx.fillText('CONTRIBUTION', 95, 500); ctx.fillStyle = '#f7f4ec'; ctx.font = '700 76px Inter, Arial, sans-serif'; wrappedText(ctx, title, 95, 610, 1500, 85); ctx.fillStyle = '#d2cfc7'; ctx.font = '28px ui-monospace, monospace'; ctx.fillText(shortenUrl(url), 95, 780);
  ctx.strokeStyle = verified ? green : 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; roundedRect(ctx, 95, 850, 1610, 120); ctx.fillStyle = verified ? green : '#f7f4ec'; ctx.font = '700 28px ui-monospace, monospace'; ctx.fillText(verified ? '✓  RECORDED ON TECHNOCORE' : '•  NOT YET VERIFIED', 125, 900); ctx.fillStyle = '#aaa79f'; ctx.font = '22px ui-monospace, monospace'; ctx.fillText(verified ? `SIGNED RECORD  ·  /technocore  ·  #${record.record.sequence}  ·  ${formatDate(record.record.recordedAt)}` : 'Add a matching DID and contribution link to verify.', 125, 943);
  ctx.fillStyle = '#aaa79f'; ctx.font = '20px ui-monospace, monospace'; ctx.fillText('SIGNED DID', 95, 1035); ctx.fillStyle = '#f7f4ec'; ctx.font = '26px ui-monospace, monospace'; ctx.fillText(shortenDid(did), 95, 1080); return canvas;
}
$('#download').addEventListener('click', () => { const canvas = passportCanvas(); const link = document.createElement('a'); link.download = 'technocore-contribution-passport.png'; link.href = canvas.toDataURL('image/png'); link.click(); $('#feedback').textContent = 'Downloaded — your contribution passport is ready.'; });
$('#share').addEventListener('click', async () => { const did = fields.did.value.trim() || 'did:key:…'; const title = fields.title.value.trim() || 'a contribution'; const text = `${fields.name.value.trim() || 'A contributor'} recorded ${title} on Technocore.\n\n${did}\n${fields.url.value.trim()}`; try { if (navigator.share) await navigator.share({ title: 'Technocore Contribution Passport', text }); else { await navigator.clipboard.writeText(text); $('#feedback').textContent = 'Share text copied to your clipboard.'; } } catch (error) { if (error.name !== 'AbortError') $('#feedback').textContent = 'Sharing is unavailable in this browser.'; } });
updateCard();
