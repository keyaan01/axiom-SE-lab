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
  del(p, b) { return this._req('DELETE', p, b); },

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

  // POST a JSON body and read the response as a text/plain STREAM (used by
  // the reader's "Ask AI" feature — POST /concepts/:id/ask streams the answer
  // in as it's generated instead of waiting for the full response). Calls
  // onChunk(delta) for every chunk decoded off the wire (the caller
  // accumulates — this passes the incremental delta, not the running total)
  // and resolves with the full accumulated text once the stream ends. `signal`
  // (an AbortController's signal) lets the caller cancel an in-flight ask.
  async stream(path, body, onChunk, { signal } = {}) {
    const res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      credentials: 'same-origin',
      signal,
    });
    if (!res.ok) {
      if (res.status === 401) window.dispatchEvent(new CustomEvent('axiom:unauthorized'));
      let msg = `POST ${path} failed (${res.status})`;
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
    // Fallback for an environment without a readable-stream body reader —
    // just resolve with the whole text in one "chunk".
    if (!res.body || typeof res.body.getReader !== 'function') {
      const text = await res.text();
      if (typeof onChunk === 'function' && text) onChunk(text);
      return text;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      full += chunk;
      if (typeof onChunk === 'function') onChunk(chunk);
    }
    full += decoder.decode(); // flush any bytes buffered for a multi-byte char split across chunks
    return full;
  },
};
