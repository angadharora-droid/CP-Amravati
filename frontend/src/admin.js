/* =========================================================
   The Desk — staff admin for the enquiry inbox
   ========================================================= */

import './admin.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const KEY = 'cp_admin_token';

const gate = document.getElementById('gate');
const desk = document.getElementById('desk');
const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginErr = document.getElementById('loginErr');
const who = document.getElementById('who');
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const summary = document.getElementById('summary');

let token = localStorage.getItem(KEY);
let filter = 'all';

/* ---------- the one place we talk to the API ---------- */
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (res.status === 401) {
    signOut();
    throw new Error('Session expired. Sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong.');
  return data;
}

/* ---------- login ---------- */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErr.hidden = true;
  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in…';

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not sign in.');

    token = data.token;
    localStorage.setItem(KEY, token);
    openDesk(data.admin);
  } catch (err) {
    loginErr.textContent = err.message;
    loginErr.hidden = false;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign in';
  }
});

function signOut() {
  localStorage.removeItem(KEY);
  token = null;
  desk.hidden = true;
  gate.hidden = false;
}
document.getElementById('signout').addEventListener('click', signOut);

function openDesk(admin) {
  gate.hidden = true;
  desk.hidden = false;
  who.textContent = admin.name;
  load();
}

/* ---------- filters ---------- */
document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;

  document.querySelectorAll('.filter').forEach((b) => b.classList.remove('is-on'));
  btn.classList.add('is-on');
  filter = btn.dataset.status;
  load();
});

/* ---------- render ---------- */
const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

const when = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

// A contact string is either a phone number or an email — link it accordingly.
const contactHref = (c) => (c.includes('@') ? `mailto:${c}` : `tel:${c.replace(/\s/g, '')}`);

function card(e) {
  const msg = e.message
    ? `<p class="card__msg">${escape(e.message)}</p>`
    : `<p class="card__msg card__msg--none">No message left.</p>`;

  return `
    <article class="card" data-status="${e.status}" data-id="${e._id}">
      <div class="card__top">
        <h3 class="card__name">${escape(e.name)}</h3>
        <span class="card__ref">${escape(e.reference)}</span>
      </div>

      <div class="card__meta">
        <span class="tag tag--topic">${escape(e.topic)}</span>
        <a class="tag tag--contact" href="${contactHref(e.contact)}">${escape(e.contact)}</a>
        <span class="tag">${escape(e.status)}</span>
      </div>

      ${msg}

      <div class="card__foot">
        <span class="card__when">${when(e.createdAt)}</span>
        <div class="card__acts">
          ${e.status !== 'replied' ? `<button class="act" data-act="replied">Mark replied</button>` : ''}
          ${e.status !== 'archived' ? `<button class="act" data-act="archived">Archive</button>` : ''}
          ${e.status !== 'new' ? `<button class="act" data-act="new">Reopen</button>` : ''}
          <button class="act act--danger" data-act="delete">Delete</button>
        </div>
      </div>
    </article>`;
}

async function load() {
  try {
    const { enquiries, tally, total } = await api(`/api/enquiries?status=${filter}`);

    document.getElementById('cAll').textContent = total;
    document.getElementById('cNew').textContent = tally.new;
    document.getElementById('cReplied').textContent = tally.replied;
    document.getElementById('cArchived').textContent = tally.archived;

    summary.textContent = tally.new
      ? `${tally.new} waiting on a reply.`
      : 'Nothing waiting. The inbox is clear.';

    list.innerHTML = enquiries.map(card).join('');
    empty.hidden = enquiries.length > 0;
  } catch (err) {
    summary.textContent = err.message;
  }
}

/* ---------- actions ---------- */
list.addEventListener('click', async (e) => {
  const btn = e.target.closest('.act');
  if (!btn) return;

  const el = btn.closest('.card');
  const id = el.dataset.id;
  const act = btn.dataset.act;

  if (act === 'delete' && !confirm('Delete this enquiry for good?')) return;

  el.querySelectorAll('.act').forEach((b) => (b.disabled = true));

  try {
    if (act === 'delete') {
      await api(`/api/enquiries/${id}`, { method: 'DELETE' });
    } else {
      await api(`/api/enquiries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: act }),
      });
    }
    await load();
  } catch (err) {
    alert(err.message);
    el.querySelectorAll('.act').forEach((b) => (b.disabled = false));
  }
});

/* ---------- resume a session ---------- */
if (token) {
  api('/api/auth/me')
    .then(openDesk)
    .catch(() => signOut());
}
