/* =========================================================
   The Desk — staff admin. Three views:
   Bookings · Enquiries · Rooms & Rates.
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

let token = localStorage.getItem(KEY);
let bkFilter = 'all';
let enqFilter = 'all';
let roomsCache = [];

/* ---------- helpers ---------- */
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

const escape = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const contactHref = (c) => (c.includes('@') ? `mailto:${c}` : `tel:${c.replace(/\s/g, '')}`);

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
  loadBookings();
}

/* ---------- tabs ---------- */
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('is-on'));
  btn.classList.add('is-on');
  const tab = btn.dataset.tab;
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${tab}`; });
  if (tab === 'bookings') loadBookings();
  if (tab === 'enquiries') loadEnquiries();
  if (tab === 'rooms') { loadRooms(); loadBlocks(); }
});

/* =========================================================
   BOOKINGS
   ========================================================= */
const bkList = document.getElementById('bkList');
const bkEmpty = document.getElementById('bkEmpty');
const bkSummary = document.getElementById('bkSummary');

document.getElementById('bkFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  document.querySelectorAll('#bkFilters .filter').forEach((b) => b.classList.remove('is-on'));
  btn.classList.add('is-on');
  bkFilter = btn.dataset.status;
  loadBookings();
});

const STATUS_LABEL = {
  pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked-in',
  checked_out: 'Checked-out', cancelled: 'Cancelled',
};
// Which status buttons to offer next, per current status.
const NEXT = {
  pending: [['confirmed', 'Confirm'], ['cancelled', 'Cancel']],
  confirmed: [['checked_in', 'Check in'], ['cancelled', 'Cancel']],
  checked_in: [['checked_out', 'Check out']],
  checked_out: [],
  cancelled: [['confirmed', 'Reinstate']],
};

function bookingCard(b) {
  const nextBtns = (NEXT[b.status] || [])
    .map(([s, label]) => `<button class="act" data-act="status" data-value="${s}">${label}</button>`).join('');
  const payToggle = b.paymentStatus === 'paid'
    ? `<button class="act" data-act="pay" data-value="unpaid">Mark unpaid</button>`
    : `<button class="act" data-act="pay" data-value="paid">Mark paid</button>`;

  return `
    <article class="card bcard" data-status="${b.status}" data-id="${b._id}">
      <div class="card__top">
        <h3 class="card__name">${escape(b.guestName)}</h3>
        <span class="card__ref">${escape(b.reference)}</span>
      </div>

      <div class="card__meta">
        <span class="tag tag--topic">${escape(b.roomName)}</span>
        <span class="tag pill pill--${b.status}">${STATUS_LABEL[b.status] || b.status}</span>
        <span class="tag pill pill--pay-${b.paymentStatus}">${b.paymentStatus}</span>
      </div>

      <div class="bgrid">
        <div><span>Check-in</span><b>${day(b.checkIn)}</b></div>
        <div><span>Check-out</span><b>${day(b.checkOut)}</b></div>
        <div><span>Stay</span><b>${b.nights}N · ${b.rooms} room(s) · ${b.guests} guest(s)</b></div>
        <div><span>Total</span><b>${rupees(b.totalAmount)}</b></div>
      </div>

      <div class="card__meta" style="margin-top:12px">
        <a class="tag tag--contact" href="${contactHref(b.email)}">${escape(b.email)}</a>
        <a class="tag tag--contact" href="${contactHref(b.phone)}">${escape(b.phone)}</a>
      </div>
      ${b.requests ? `<p class="card__msg">“${escape(b.requests)}”</p>` : ''}

      <label class="noteline">
        <span>Staff note</span>
        <input class="noteinput" data-act="note" value="${escape(b.note)}" placeholder="Internal note…" />
      </label>

      <div class="card__foot">
        <span class="card__when">Booked ${when(b.createdAt)}</span>
        <div class="card__acts">
          ${nextBtns}
          ${payToggle}
          <button class="act act--danger" data-act="delete">Delete</button>
        </div>
      </div>
    </article>`;
}

async function loadBookings() {
  bkSummary.textContent = 'Loading…';
  try {
    const { bookings, tally, total, paidRevenue } = await api(`/api/bookings?status=${bkFilter}`);
    document.getElementById('bkAll').textContent = total;
    ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'].forEach((s) => {
      const el = document.getElementById('bk' + s.charAt(0).toUpperCase() + s.slice(1));
      if (el) el.textContent = tally[s] || 0;
    });
    const arriving = tally.confirmed || 0;
    bkSummary.textContent = `${arriving} confirmed · ${rupees(paidRevenue)} collected`;
    bkList.innerHTML = bookings.map(bookingCard).join('');
    bkEmpty.hidden = bookings.length > 0;
  } catch (err) {
    bkSummary.textContent = err.message;
  }
}

bkList.addEventListener('click', async (e) => {
  const btn = e.target.closest('.act');
  if (!btn) return;
  const el = btn.closest('.bcard');
  const id = el.dataset.id;
  const act = btn.dataset.act;
  if (act === 'delete' && !confirm('Delete this booking for good?')) return;
  el.querySelectorAll('.act').forEach((b) => (b.disabled = true));
  try {
    if (act === 'delete') await api(`/api/bookings/${id}`, { method: 'DELETE' });
    else if (act === 'status') await api(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status: btn.dataset.value }) });
    else if (act === 'pay') await api(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ paymentStatus: btn.dataset.value }) });
    await loadBookings();
  } catch (err) {
    alert(err.message);
    el.querySelectorAll('.act').forEach((b) => (b.disabled = false));
  }
});

// Save note on blur / Enter.
bkList.addEventListener('change', async (e) => {
  const input = e.target.closest('.noteinput');
  if (!input) return;
  const id = input.closest('.bcard').dataset.id;
  try {
    await api(`/api/bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ note: input.value }) });
    input.classList.add('saved');
    setTimeout(() => input.classList.remove('saved'), 900);
  } catch (err) { alert(err.message); }
});

/* =========================================================
   ENQUIRIES  (unchanged behaviour, scoped to its view)
   ========================================================= */
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const summary = document.getElementById('summary');

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter');
  if (!btn) return;
  document.querySelectorAll('#filters .filter').forEach((b) => b.classList.remove('is-on'));
  btn.classList.add('is-on');
  enqFilter = btn.dataset.status;
  loadEnquiries();
});

function enquiryCard(e) {
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

async function loadEnquiries() {
  try {
    const { enquiries, tally, total } = await api(`/api/enquiries?status=${enqFilter}`);
    document.getElementById('cAll').textContent = total;
    document.getElementById('cNew').textContent = tally.new;
    document.getElementById('cReplied').textContent = tally.replied;
    document.getElementById('cArchived').textContent = tally.archived;
    summary.textContent = tally.new ? `${tally.new} waiting on a reply.` : 'Nothing waiting. The inbox is clear.';
    list.innerHTML = enquiries.map(enquiryCard).join('');
    empty.hidden = enquiries.length > 0;
  } catch (err) {
    summary.textContent = err.message;
  }
}

list.addEventListener('click', async (e) => {
  const btn = e.target.closest('.act');
  if (!btn) return;
  const el = btn.closest('.card');
  const id = el.dataset.id;
  const act = btn.dataset.act;
  if (act === 'delete' && !confirm('Delete this enquiry for good?')) return;
  el.querySelectorAll('.act').forEach((b) => (b.disabled = true));
  try {
    if (act === 'delete') await api(`/api/enquiries/${id}`, { method: 'DELETE' });
    else await api(`/api/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status: act }) });
    await loadEnquiries();
  } catch (err) {
    alert(err.message);
    el.querySelectorAll('.act').forEach((b) => (b.disabled = false));
  }
});

/* =========================================================
   ROOMS & RATES
   ========================================================= */
const rmList = document.getElementById('rmList');
const rmSummary = document.getElementById('rmSummary');

function roomRow(r) {
  return `
    <article class="room ${r.active ? '' : 'is-off'}" data-id="${r._id}">
      <div class="room__fig">${r.image ? `<img src="${escape(r.image)}" alt="" />` : '<span>no image</span>'}</div>
      <div class="room__body">
        <div class="room__name">${escape(r.name)} <em>/${escape(r.slug)}</em></div>
        <div class="room__sub">${escape(r.size || '')} · sleeps ${r.maxOccupancy}</div>
        ${(r.roomNumbers && r.roomNumbers.length)
          ? `<div class="room__nums" title="Room numbers — staff only">${r.roomNumbers.map((n) => escape(n)).join(' · ')}</div>`
          : ''}
      </div>
      <label class="room__f"><span>Price/night</span><input type="number" min="0" data-field="basePrice" value="${r.basePrice}" /></label>
      <label class="room__f"><span>Total rooms</span><input type="number" min="0" data-field="totalRooms" value="${r.totalRooms}" /></label>
      <button class="room__toggle ${r.active ? 'on' : ''}" data-act="toggle" title="Active on website">${r.active ? 'Active' : 'Hidden'}</button>
      <div class="room__acts">
        <button class="act" data-act="save">Save</button>
        <button class="act" data-act="edit">Edit</button>
        <button class="act act--danger" data-act="delete">Delete</button>
      </div>
    </article>`;
}

async function loadRooms() {
  rmSummary.textContent = 'Loading…';
  try {
    const { rooms } = await api('/api/rooms');
    roomsCache = rooms;
    const total = rooms.reduce((n, r) => n + (r.active ? r.totalRooms : 0), 0);
    rmSummary.textContent = `${rooms.length} room types · ${total} rooms bookable`;
    rmList.innerHTML = rooms.map(roomRow).join('');
    // fill the block-form room dropdown
    const sel = document.getElementById('blkRoom');
    sel.innerHTML = '<option value="">All rooms</option>' +
      rooms.map((r) => `<option value="${r._id}">${escape(r.name)}</option>`).join('');
  } catch (err) {
    rmSummary.textContent = err.message;
  }
}

rmList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const el = btn.closest('.room');
  const id = el.dataset.id;
  const act = btn.dataset.act;
  try {
    if (act === 'save') {
      const body = {};
      el.querySelectorAll('input[data-field]').forEach((i) => { body[i.dataset.field] = Number(i.value); });
      await api(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      flash(btn, 'Saved');
      loadRooms();
    } else if (act === 'toggle') {
      const room = roomsCache.find((r) => r._id === id);
      await api(`/api/rooms/${id}`, { method: 'PATCH', body: JSON.stringify({ active: !room.active }) });
      loadRooms();
    } else if (act === 'edit') {
      openRoomModal(roomsCache.find((r) => r._id === id));
    } else if (act === 'delete') {
      if (!confirm('Delete this room type? Existing bookings keep their record.')) return;
      await api(`/api/rooms/${id}`, { method: 'DELETE' });
      loadRooms();
    }
  } catch (err) { alert(err.message); }
});

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = old), 1000);
}

/* ---- room modal (add / edit) ---- */
const roomModal = document.getElementById('roomModal');
const roomForm = document.getElementById('roomForm');
const roomErr = document.getElementById('roomErr');
let editingId = null;

document.getElementById('addRoomBtn').addEventListener('click', () => openRoomModal(null));

function openRoomModal(room) {
  editingId = room?._id || null;
  document.getElementById('roomModalTitle').textContent = room ? 'Edit room type' : 'Add room type';
  roomErr.hidden = true;
  roomForm.reset();
  if (room) {
    roomForm.name.value = room.name;
    roomForm.slug.value = room.slug;
    roomForm.basePrice.value = room.basePrice;
    roomForm.totalRooms.value = room.totalRooms;
    roomForm.maxOccupancy.value = room.maxOccupancy;
    roomForm.size.value = room.size || '';
    roomForm.image.value = room.image || '';
    roomForm.sortOrder.value = room.sortOrder || 0;
    roomForm.description.value = room.description || '';
    roomForm.amenities.value = (room.amenities || []).join(', ');
    roomForm.roomNumbers.value = (room.roomNumbers || []).join(', ');
    roomForm.active.checked = room.active;
  } else {
    roomForm.active.checked = true;
    roomForm.maxOccupancy.value = 2;
  }
  roomModal.showModal();
}

roomForm.addEventListener('submit', async (e) => {
  // The dialog's "cancel" button submits too; only act on save.
  if (e.submitter && e.submitter.value !== 'save') return;
  e.preventDefault();
  roomErr.hidden = true;
  const body = {
    name: roomForm.name.value.trim(),
    slug: roomForm.slug.value.trim(),
    basePrice: Number(roomForm.basePrice.value),
    totalRooms: Number(roomForm.totalRooms.value),
    maxOccupancy: Number(roomForm.maxOccupancy.value) || 2,
    size: roomForm.size.value.trim(),
    image: roomForm.image.value.trim(),
    sortOrder: Number(roomForm.sortOrder.value) || 0,
    description: roomForm.description.value.trim(),
    amenities: roomForm.amenities.value.split(',').map((s) => s.trim()).filter(Boolean),
    roomNumbers: roomForm.roomNumbers.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean),
    active: roomForm.active.checked,
  };
  // Room numbers, when given, drive the count. When the field is empty, omit it
  // entirely so a count-managed room isn't wiped to zero — keep totalRooms instead.
  if (body.roomNumbers.length) delete body.totalRooms;
  else delete body.roomNumbers;
  try {
    if (editingId) await api(`/api/rooms/${editingId}`, { method: 'PATCH', body: JSON.stringify(body) });
    else await api('/api/rooms', { method: 'POST', body: JSON.stringify(body) });
    roomModal.close();
    loadRooms();
  } catch (err) {
    roomErr.textContent = err.message;
    roomErr.hidden = false;
  }
});

/* =========================================================
   BLOCKS (close-outs & rate overrides)
   ========================================================= */
const blkList = document.getElementById('blkList');
const blockForm = document.getElementById('blockForm');
const blockErr = document.getElementById('blockErr');

function blockRow(b) {
  const parts = [];
  if (b.closed) parts.push('<span class="pill pill--cancelled">Closed</span>');
  if (b.price != null) parts.push(`<span class="pill pill--confirmed">${rupees(b.price)}/night</span>`);
  return `
    <div class="blk" data-id="${b._id}">
      <div class="blk__main">
        <b>${b.roomType ? escape(b.roomType.name) : 'All rooms'}</b>
        <span>${day(b.from)} → ${day(b.to)}</span>
        ${b.label ? `<em>${escape(b.label)}</em>` : ''}
      </div>
      <div class="blk__tags">${parts.join(' ')}</div>
      <button class="act act--danger" data-act="delblock">Remove</button>
    </div>`;
}

async function loadBlocks() {
  try {
    const { blocks } = await api('/api/blocks');
    blkList.innerHTML = blocks.length
      ? blocks.map(blockRow).join('')
      : '<p class="blk__none">No close-outs or overrides. All rooms open at their base rate.</p>';
  } catch (err) {
    blkList.innerHTML = `<p class="blk__none">${escape(err.message)}</p>`;
  }
}

blockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  blockErr.hidden = true;
  const body = {
    roomType: blockForm.roomType.value || null,
    from: blockForm.from.value,
    to: blockForm.to.value,
    closed: blockForm.closed.checked,
    price: blockForm.price.value === '' ? null : Number(blockForm.price.value),
    label: blockForm.label.value.trim(),
  };
  try {
    await api('/api/blocks', { method: 'POST', body: JSON.stringify(body) });
    blockForm.reset();
    loadBlocks();
  } catch (err) {
    blockErr.textContent = err.message;
    blockErr.hidden = false;
  }
});

blkList.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act="delblock"]');
  if (!btn) return;
  const id = btn.closest('.blk').dataset.id;
  try {
    await api(`/api/blocks/${id}`, { method: 'DELETE' });
    loadBlocks();
  } catch (err) { alert(err.message); }
});

/* ---------- resume a session ---------- */
if (token) {
  api('/api/auth/me').then(openDesk).catch(() => signOut());
}
