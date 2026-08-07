const PASSWORD_UTILS = {
  async hash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 600000;
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    const saltB64 = btoa(String.fromCharCode(...salt));
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return saltB64 + ':' + iterations + ':' + hashHex;
  },

  async verify(password, stored) {
    if (!stored || typeof stored !== 'string') return false;
    const parts = stored.split(':');
    if (parts.length === 3) {
      const [saltB64, iterationsStr, hashHex] = parts;
      try {
        const iterations = parseInt(iterationsStr, 10);
        const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
        const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
        const computedHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
        return computedHex === hashHex;
      } catch { return false; }
    }
    return stored === password;
  },

  isHashed(stored) {
    return stored && typeof stored === 'string' && stored.split(':').length === 3;
  }
};
