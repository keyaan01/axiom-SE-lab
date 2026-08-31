// Reusable UI primitives: escaping, toasts, and modal dialogs.
// Kept deliberately small and dependency-free so every screen shares one look.

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function mountOverlay(cardHtml) {
  const overlay = document.createElement('div');
  // z-[75]: layering stack is reader overlay (55) < pomodoro tray (60) < auth gate
  // (70) < modals (75) < toasts (80). Modals must render ABOVE the PDF reader (so
  // the Pomodoro popup from the reader navbar is visible) AND above the auth gate
  // (so the "replace account?" confirm on re-registration isn't stuck behind the
  // full-screen login screen — which made signup look like it did nothing).
  overlay.className =
    'fixed inset-0 z-[75] flex items-center justify-center bg-[rgba(20,16,25,.45)] p-4 backdrop-blur-sm';
  overlay.innerHTML =
    `<div class="modal-card w-full max-w-md" role="dialog" aria-modal="true">${cardHtml}</div>`;
  document.body.appendChild(overlay);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  return { card: overlay.firstElementChild, close };
}

// A modal with arbitrary body inputs and a primary submit button.
// onSubmit(rootEl) may throw an Error to display an inline message and stay open.
function formModal({ title, submitLabel = 'Create', bodyHtml, onSubmit }) {
  const { card, close } = mountOverlay(`
    <form class="p-5">
      <h3 class="text-lg font-semibold text-ink">${escapeHtml(title)}</h3>
      <div class="mt-4 space-y-3">${bodyHtml}</div>
      <p data-err class="mt-3 hidden text-sm" style="color:var(--danger)"></p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" data-cancel class="btn btn-ghost">Cancel</button>
        <button type="submit" data-submit class="btn btn-primary">${escapeHtml(submitLabel)}</button>
      </div>
    </form>`);
  const err = card.querySelector('[data-err]');
  const submit = card.querySelector('[data-submit]');
  card.querySelector('[data-cancel]').addEventListener('click', close);
  const first = card.querySelector('input, textarea');
  if (first) first.focus();
  card.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err.classList.add('hidden');
    submit.disabled = true;
    const label = submit.textContent;
    submit.textContent = 'Working…';
    try {
      await onSubmit(card);
      close();
    } catch (ex) {
      err.textContent = ex.message || 'Something went wrong';
      err.classList.remove('hidden');
    } finally {
      submit.disabled = false;
      submit.textContent = label;
    }
  });
}

// A destructive confirmation dialog.
function confirmModal({ title, message, confirmLabel = 'Delete', onConfirm }) {
  const { card, close } = mountOverlay(`
    <div class="p-5">
      <h3 class="text-lg font-semibold text-ink">${escapeHtml(title)}</h3>
      <p class="mt-2 text-sm text-muted">${escapeHtml(message)}</p>
      <p data-err class="mt-3 hidden text-sm" style="color:var(--danger)"></p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" data-cancel class="btn btn-ghost">Cancel</button>
        <button type="button" data-confirm class="btn btn-danger">${escapeHtml(confirmLabel)}</button>
      </div>
    </div>`);
  const err = card.querySelector('[data-err]');
  const btn = card.querySelector('[data-confirm]');
  card.querySelector('[data-cancel]').addEventListener('click', close);
  btn.focus();
  btn.addEventListener('click', async () => {
    err.classList.add('hidden');
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = 'Working…';
    try {
      await onConfirm();
      close();
    } catch (ex) {
      err.textContent = ex.message || 'Failed';
      err.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });
}

function toast(message, kind = 'success') {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    // z-[80]: above modals (60), the pomodoro tray (60), and the auth gate (70)
    // — per DESIGN.md §7 toasts sit at the very top of the stack.
    host.className = 'fixed bottom-4 right-4 z-[80] flex flex-col gap-2';
    document.body.appendChild(host);
  }
  const accent = kind === 'error' ? 'var(--danger)' : 'var(--success)';
  const t = document.createElement('div');
  t.className = 'rounded-lg px-3.5 py-2 text-sm font-medium transition-opacity duration-300';
  t.style.background = 'var(--surface)';
  t.style.color = 'var(--text)';
  t.style.boxShadow = 'var(--shadow-lg)';
  t.style.borderLeft = `3px solid ${accent}`;
  t.style.animation = 'rise var(--dur) var(--ease-out)';
  t.textContent = message;
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
}

const ui = { escapeHtml, mountOverlay, formModal, confirmModal, toast };
