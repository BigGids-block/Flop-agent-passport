const $ = (selector) => document.querySelector(selector);
const DID_PATTERN = /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]{44}$/;
const fields = { did: $('#did') };
const card = {
  did: $('#card-did'), name: $('#card-name'), room: $('#card-room'), date: $('#card-date'),
  message: $('#card-message'), avatar: $('#avatar'), number: $('#agent-number'),
  lookup: $('#lookup-status'), activity: $('#activity-status'),
};
let profile = null;
let lookupTimer = null;
let lookupInProgress = false;

function shortenDid(did) {
  if (!did) return 'did:key:—';
  return did.length > 26 ? `${did.slice(0, 15)}…${did.slice(-7)}` : did;
}

function numberFromDid(did) {
  let hash = 0;
  for (const char of did) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return String((hash % 9999) + 1).padStart(4, '0');
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date).toUpperCase();
}

function setActivityStatus(text) {
  card.activity.innerHTML = `<span>✓</span> ${text}`;
}

function updateCard() {
  const did = fields.did.value.trim();
  const number = did ? numberFromDid(did) : '0001';
  const hasProfile = profile?.did === did;
  card.did.textContent = shortenDid(did);
  card.name.textContent = did ? `Agent ${number}` : 'Unclaimed Agent';
  card.avatar.textContent = did ? number.slice(-1) : '?';
  card.number.textContent = number;

  if (!did) {
    card.room.textContent = 'NOT LOOKED UP'; card.date.textContent = '—';
    card.message.textContent = '“Paste a DID to find its public activity.”';
    card.lookup.textContent = 'PASTE A DID'; setActivityStatus('SELF-DECLARED IDENTITY');
  } else if (!DID_PATTERN.test(did)) {
    card.room.textContent = 'INVALID DID'; card.date.textContent = '—';
    card.message.textContent = '“Enter a full did:key to create a passport.”';
    card.lookup.textContent = 'CHECK DID'; setActivityStatus('SELF-DECLARED IDENTITY');
  } else if (lookupInProgress) {
    card.room.textContent = 'SEARCHING…'; card.date.textContent = 'SEARCHING…';
    card.message.textContent = '“Checking public signed Technocore records.”';
    card.lookup.textContent = 'LOOKING UP…'; setActivityStatus('PUBLIC LOOKUP');
  } else if (hasProfile) {
    card.room.textContent = profile.activity; card.date.textContent = profile.firstSeen;
    card.message.textContent = `“${profile.summary}”`;
    card.lookup.textContent = profile.lookup; setActivityStatus(profile.status);
  } else {
    card.room.textContent = 'READY TO LOOK UP'; card.date.textContent = '—';
    card.message.textContent = '“Your passport will include public activity when found.”';
    card.lookup.textContent = 'READY'; setActivityStatus('SELF-DECLARED IDENTITY');
  }
}

async function loadActivity(did) {
  lookupInProgress = true; profile = null; updateCard();
  try {
    const response = await fetch(`/api/activity?did=${encodeURIComponent(did)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Lookup returned ${response.status}.`);
    const activity = await response.json();
    if (fields.did.value.trim() !== did) return;
    profile = {
      did,
      activity: activity.activity,
      firstSeen: activity.firstSeen ? formatDate(activity.firstSeen) : 'NOT FOUND',
      lookup: activity.lookup,
      status: activity.status,
      summary: activity.summary,
    };
  } catch (error) {
    if (fields.did.value.trim() !== did) return;
    profile = {
      did, activity: 'UNAVAILABLE', firstSeen: '—', lookup: 'LOOKUP UNAVAILABLE', status: 'SELF-DECLARED IDENTITY',
      summary: 'Public activity could not be loaded. Your identity card is still ready.',
    };
  } finally {
    if (fields.did.value.trim() === did) { lookupInProgress = false; updateCard(); }
  }
}

fields.did.addEventListener('input', () => {
  clearTimeout(lookupTimer); profile = null; lookupInProgress = false; updateCard();
  const did = fields.did.value.trim();
  if (!DID_PATTERN.test(did)) return;
  lookupTimer = setTimeout(() => loadActivity(did), 550);
});
updateCard();

$('#passport-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const did = fields.did.value.trim();
  const error = $('#did-error');
  if (!DID_PATTERN.test(did)) {
    error.textContent = 'Enter a full Technocore did:key identifier.';
    fields.did.focus(); return;
  }
  error.textContent = ''; loadActivity(did);
});

function roundedRect(ctx, x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.stroke(); }
function wrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' '); let line = ''; let row = 0;
  for (const word of words) {
    const next = `${line}${word} `;
    if (ctx.measureText(next).width > maxWidth && line) { ctx.fillText(line.trim(), x, y + row * lineHeight); line = `${word} `; row += 1; } else line = next;
  }
  ctx.fillText(line.trim(), x, y + row * lineHeight);
}
function passportCanvas() {
  const canvas = document.createElement('canvas'); canvas.width = 1800; canvas.height = 1160;
  const ctx = canvas.getContext('2d'); const did = fields.did.value.trim() || 'did:key:—';
  const number = did !== 'did:key:—' ? numberFromDid(did) : '0001'; const name = did !== 'did:key:—' ? `Agent ${number}` : 'Unclaimed Agent'; const green = '#d9ff4a';
  ctx.fillStyle = '#101118'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createRadialGradient(1500, -140, 20, 1500, -140, 700); glow.addColorStop(0, '#c5e959'); glow.addColorStop(.25, 'rgba(197,233,89,.28)'); glow.addColorStop(1, 'rgba(197,233,89,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 3; roundedRect(ctx, 28, 28, 1744, 1104, 0);
  ctx.fillStyle = '#f7f4ec'; ctx.font = '600 30px ui-monospace, monospace'; ctx.fillText('✦  TECHNOCORE', 95, 122);
  ctx.fillStyle = '#bebbb5'; ctx.textAlign = 'right'; ctx.font = '24px ui-monospace, monospace'; ctx.fillText(`AGENT / ${number}`, 1705, 122); ctx.textAlign = 'left';
  ctx.fillStyle = green; ctx.beginPath(); ctx.arc(150, 335, 76, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#101118'; ctx.textAlign = 'center'; ctx.font = '700 72px Inter, Arial, sans-serif'; ctx.fillText(did !== 'did:key:—' ? number.slice(-1) : '?', 150, 360); ctx.textAlign = 'left';
  ctx.fillStyle = '#aaa79f'; ctx.font = '20px ui-monospace, monospace'; ctx.fillText('AGENT IDENTITY', 270, 286); ctx.fillStyle = '#f7f4ec'; ctx.font = '700 80px Inter, Arial, sans-serif'; ctx.fillText(name, 270, 375);
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.moveTo(95, 530); ctx.lineTo(1705, 530); ctx.stroke();
  const labels = ['DID', 'ACTIVITY', 'FIRST SEEN']; const values = [shortenDid(did), card.room.textContent, card.date.textContent]; const positions = [95, 850, 1250];
  labels.forEach((label, index) => { ctx.fillStyle = '#9d9a94'; ctx.font = '20px ui-monospace, monospace'; ctx.fillText(label, positions[index], 600); ctx.fillStyle = '#f7f4ec'; ctx.font = '25px ui-monospace, monospace'; ctx.fillText(values[index], positions[index], 650); });
  ctx.fillStyle = '#d2cfc7'; ctx.font = '36px Inter, Arial, sans-serif'; wrappedText(ctx, card.message.textContent, 95, 805, 1210, 50);
  ctx.fillStyle = green; ctx.font = '19px ui-monospace, monospace'; ctx.fillText(`✓  ${card.activity.textContent.replace('✓', '').trim()}`, 95, 1060);
  for (let y = 0; y < 3; y += 1) for (let x = 0; x < 3; x += 1) { ctx.fillStyle = (x + y) % 2 ? '#454640' : '#ebe9e1'; ctx.fillRect(1600 + x * 20, 1000 + y * 20, 17, 17); }
  return canvas;
}
$('#download').addEventListener('click', () => {
  const canvas = passportCanvas(); const link = document.createElement('a'); link.download = `technocore-agent-passport-${card.number.textContent}.png`; link.href = canvas.toDataURL('image/png'); link.click(); $('#feedback').textContent = 'Downloaded — your passport is ready.';
});
$('#share').addEventListener('click', async () => {
  const did = fields.did.value.trim() || 'did:key:…'; const text = `Meet ${card.name.textContent} ✦\n\n${card.message.textContent}\n${did}`;
  try { if (navigator.share) await navigator.share({ title: 'Agent Passport', text }); else { await navigator.clipboard.writeText(text); $('#feedback').textContent = 'Share text copied to your clipboard.'; } } catch (error) { if (error.name !== 'AbortError') $('#feedback').textContent = 'Sharing is unavailable in this browser.'; }
});
