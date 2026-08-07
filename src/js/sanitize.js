function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, ch => map[ch]);
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const allowedProto = ['http:', 'https:', 'data:'];
  try {
    const u = new URL(url, window.location.origin);
    if (allowedProto.includes(u.protocol)) return url;
  } catch (_) {}
  return '';
}

function validateNumber(val, fallback) {
  const n = Number(val);
  return !isNaN(n) && isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
}

function validateInt(val, fallback) {
  const n = parseInt(val, 10);
  return !isNaN(n) && isFinite(n) ? n : (fallback !== undefined ? fallback : 0);
}

function validateStr(val, maxLen) {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  return maxLen ? s.slice(0, maxLen) : s;
}

function escapeEscPos(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function stripNonAscii(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[^\x20-\x7E]/g, '');
}
