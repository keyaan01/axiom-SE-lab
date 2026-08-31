// Thin JSON fetch wrapper. Every backend call goes through /api.
// Surfaces FastAPI's { "detail": ... } errors as readable Error messages.
const api = {
  async _req(method, path, body) {
    const opts = { method, headers: {}, credentials: 'same-origin' };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`/api${path}`, opts);
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new CustomEvent('axiom:unauthorized'));
      let msg = `${method} ${path} failed (${res.status})`;
      try {
        const j = await res.json();
        if (j && j.detail) {
          msg = typeof j.detail === 'string'
            ? j.detail
            : (Array.isArray(j.detail) && j.detail[0] && j.detail[0].msg) || JSON.stringify(j.detail);
        }
      } catch (_) { /* non-JSON error body */ }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  },
  get(p) { return this._req('GET', p); },
  post(p, b) { return this._req('POST', p, b); },
  patch(p, b) { return this._req('PATCH', p, b); },
  put(p, b) { return this._req('PUT', p, b); },
  del(p) { return this._req('DELETE', p); },

  // Multipart upload (FormData) — used for file uploads.
  async upload(path, formData) {
    const res = await fetch(`/api${path}`, { method: 'POST', body: formData, credentials: 'same-origin' });
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new CustomEvent('axiom:unauthorized'));
      let msg = `Upload failed (${res.status})`;
      try {
        const j = await res.json();
        if (j && j.detail) {
          msg = typeof j.detail === 'string'
            ? j.detail
            : (Array.isArray(j.detail) && j.detail[0] && j.detail[0].msg) || JSON.stringify(j.detail);
        }
      } catch (_) { /* non-JSON error body */ }
      throw new Error(msg);
    }
    return res.json();
  },
};
