/* =========================================================
   Booking engine — search → choose a room → guest details →
   pay (Razorpay) → confirmation. Talks to /api/rooms & /api/bookings.
   ========================================================= */

import './site.js';     // header, footer, shared chrome + theme.css
import './book.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const RZP_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const state = {
  checkIn: '', checkOut: '', guests: 2, rooms: 1,
  roomsData: [], stay: null, selected: null,
};

/* ---------- elements ---------- */
const panes = [...document.querySelectorAll('.bpane')];
const stepRail = document.getElementById('bsteps');
const searchForm = document.getElementById('searchForm');
const searchNote = document.getElementById('searchNote');
const roomList = document.getElementById('roomList');
const roomsTitle = document.getElementById('roomsTitle');
const guestForm = document.getElementById('guestForm');
const guestNote = document.getElementById('guestNote');
const payBtn = document.getElementById('payBtn');
const summary = document.getElementById('summary');
const summaryBody = document.getElementById('summaryBody');
const doneCard = document.getElementById('doneCard');

const STEPS = ['search', 'rooms', 'guest', 'done'];

/* ---------- step navigation ---------- */
function goto(step) {
  panes.forEach((p) => { p.hidden = p.dataset.pane !== step; });
  const idx = STEPS.indexOf(step);
  [...stepRail.children].forEach((li, i) => {
    li.classList.toggle('is-on', i === idx);
    li.classList.toggle('is-done', i < idx);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.body.addEventListener('click', (e) => {
  const back = e.target.closest('[data-goto]');
  if (back) goto(back.dataset.goto);
});

/* ---------- default the dates ---------- */
function primeDates() {
  const q = new URLSearchParams(location.search);
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 2 * 86400000);

  const ci = searchForm.checkIn, co = searchForm.checkOut;
  ci.min = iso(today);
  co.min = iso(tomorrow);
  ci.value = q.get('checkIn') || iso(tomorrow);
  co.value = q.get('checkOut') || iso(dayAfter);
  if (q.get('guests')) searchForm.guests.value = q.get('guests');
  if (q.get('rooms')) searchForm.rooms.value = q.get('rooms');

  ci.addEventListener('change', () => {
    const next = new Date(new Date(ci.value).getTime() + 86400000);
    co.min = iso(next);
    if (co.value <= ci.value) co.value = iso(next);
  });

  // If arriving with dates already chosen, run the search immediately.
  if (q.get('checkIn') && q.get('checkOut')) runSearch(q.get('room'));
}

/* ---------- step 1 → search ---------- */
searchForm.addEventListener('submit', (e) => { e.preventDefault(); runSearch(); });

async function runSearch(preselectSlug) {
  const f = searchForm;
  state.checkIn = f.checkIn.value;
  state.checkOut = f.checkOut.value;
  state.guests = Math.max(1, +f.guests.value || 1);
  state.rooms = Math.max(1, +f.rooms.value || 1);
  searchNote.hidden = true;

  if (!state.checkIn || !state.checkOut || state.checkOut <= state.checkIn) {
    searchNote.textContent = 'Please choose a check-out date after check-in.';
    searchNote.hidden = false;
    return;
  }

  goto('rooms');
  roomList.innerHTML = `<p class="bspin">Checking availability…</p>`;
  roomsTitle.textContent = 'Available rooms';

  try {
    const url = `${API}/api/rooms/public?checkIn=${state.checkIn}&checkOut=${state.checkOut}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not load rooms.');
    state.roomsData = data.rooms;
    state.stay = data.stay;
    renderRooms(preselectSlug);
  } catch (err) {
    roomList.innerHTML = `<p class="bspin">${escape(err.message)}</p>`;
  }
}

function renderRooms(preselectSlug) {
  const nights = state.stay?.nights || 1;
  roomsTitle.textContent = `${fmtDate(state.checkIn)} → ${fmtDate(state.checkOut)} · ${nights} night${nights > 1 ? 's' : ''} · ${state.rooms} room${state.rooms > 1 ? 's' : ''}`;

  const fits = state.roomsData.filter((r) => (r.availability?.available ?? 0) >= state.rooms);
  if (!fits.length) {
    roomList.innerHTML = `<p class="bspin">No rooms free for ${state.rooms} room(s) on those dates. Try fewer rooms or different dates.</p>`;
    return;
  }

  roomList.innerHTML = state.roomsData.map((r) => {
    const a = r.availability || { available: 0, avgPerNight: r.basePrice, roomTotal: r.basePrice * nights };
    const enough = a.available >= state.rooms;
    const stayTotal = a.roomTotal * state.rooms;
    const amen = (r.amenities || []).slice(0, 4).map((x) => `<span>${escape(x)}</span>`).join('');
    const stock = !enough
      ? `<div class="roomcard__stock none">${a.available > 0 ? `Only ${a.available} left` : 'Sold out'} for these dates</div>`
      : a.available <= 3
        ? `<div class="roomcard__stock low">Only ${a.available} left</div>`
        : `<div class="roomcard__stock">${a.available} available</div>`;

    return `
      <article class="roomcard ${enough ? '' : 'is-out'}" data-slug="${r.slug}">
        <div class="roomcard__fig">${r.image ? `<img src="${escape(r.image)}" alt="${escape(r.name)}" loading="lazy" />` : ''}</div>
        <div class="roomcard__body">
          <h3 class="roomcard__name">${escape(r.name)}</h3>
          <div class="roomcard__meta">
            ${r.size ? `<span>${escape(r.size)}</span>` : ''}
            <span>Sleeps ${r.maxOccupancy}</span>
          </div>
          <p class="roomcard__desc">${escape(r.description)}</p>
          <div class="roomcard__amen">${amen}</div>
        </div>
        <div class="roomcard__side">
          <div class="roomcard__price">
            <b>${rupees(a.avgPerNight)}</b><span>per night</span>
            <div class="roomcard__total">${rupees(stayTotal)} total</div>
            ${stock}
          </div>
          ${enough
            ? `<button class="btn btn--plum" data-pick="${r.slug}">Select</button>`
            : `<button class="btn" disabled>Unavailable</button>`}
        </div>
      </article>`;
  }).join('');

  if (preselectSlug) {
    const match = fits.find((r) => r.slug === preselectSlug);
    if (match) pickRoom(match.slug);
  }
}

roomList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-pick]');
  if (btn) pickRoom(btn.dataset.pick);
});

/* ---------- step 2 → pick a room ---------- */
function pickRoom(slug) {
  const room = state.roomsData.find((r) => r.slug === slug);
  if (!room) return;
  const a = room.availability;
  state.selected = {
    slug: room.slug, id: room._id, name: room.name,
    avgPerNight: a.avgPerNight, roomTotal: a.roomTotal,
    total: a.roomTotal * state.rooms,
  };
  renderSummary();
  goto('guest');
}

function renderSummary() {
  const s = state.selected;
  if (!s) { summary.hidden = true; return; }
  const nights = state.stay?.nights || 1;
  summary.hidden = false;
  summaryBody.innerHTML = `
    <div class="sumrow"><span>Room</span><b>${escape(s.name)}</b></div>
    <div class="sumrow"><span>Check-in</span><b>${fmtDate(state.checkIn)}</b></div>
    <div class="sumrow"><span>Check-out</span><b>${fmtDate(state.checkOut)}</b></div>
    <div class="sumrow"><span>Stay</span><b>${nights} night${nights > 1 ? 's' : ''} · ${state.rooms} room${state.rooms > 1 ? 's' : ''}</b></div>
    <div class="sumrow"><span>Guests</span><b>${state.guests}</b></div>
    <div class="sumrow"><span>${rupees(s.avgPerNight)} × ${nights} × ${state.rooms}</span><b>${rupees(s.total)}</b></div>
    <div class="sumrow sumrow--total"><span>Total</span><b>${rupees(s.total)}</b></div>
    <p class="summary__pay">Check-in from 2 PM · Check-out by 12 PM</p>`;
}

/* ---------- step 3 → guest details + payment ---------- */
guestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!guestForm.checkValidity()) return guestForm.reportValidity();
  guestNote.hidden = true;
  setPayBusy(true);

  const payload = {
    roomSlug: state.selected.slug,
    checkIn: state.checkIn,
    checkOut: state.checkOut,
    rooms: state.rooms,
    guests: state.guests,
    guestName: guestForm.guestName.value.trim(),
    email: guestForm.email.value.trim(),
    phone: guestForm.phone.value.trim(),
    requests: guestForm.requests.value.trim(),
  };

  try {
    const res = await fetch(`${API}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Could not create the booking.');

    if (!data.paymentsEnabled) {
      // Pay-at-hotel: already confirmed on the server.
      showDone(data.booking, false);
      return;
    }
    await payWithRazorpay(data, payload);
  } catch (err) {
    guestNote.textContent = err.message;
    guestNote.hidden = false;
    setPayBusy(false);
  }
});

function setPayBusy(busy) {
  payBtn.disabled = busy;
  payBtn.textContent = busy ? 'Please wait…' : 'Continue to payment';
}

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = RZP_SRC;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not reach the payment gateway.'));
    document.head.appendChild(s);
  });
}

async function payWithRazorpay(data, payload) {
  await loadRazorpay();
  const rzp = new window.Razorpay({
    key: data.keyId,
    amount: data.order.amount,
    currency: data.order.currency,
    name: 'Centre Point Amravati',
    description: `${data.booking.roomName} · ${data.booking.nights} night(s)`,
    order_id: data.order.id,
    prefill: { name: payload.guestName, email: payload.email, contact: payload.phone },
    theme: { color: '#a80564' },
    handler: async (resp) => {
      try {
        const vres = await fetch(`${API}/api/bookings/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: data.booking.id,
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          }),
        });
        const vdata = await vres.json();
        if (!vres.ok) throw new Error(vdata.message || 'Payment verification failed.');
        showDone(vdata.booking, true);
      } catch (err) {
        guestNote.textContent = err.message + ' If money was deducted, call the desk with your reference.';
        guestNote.hidden = false;
        setPayBusy(false);
      }
    },
    modal: { ondismiss: () => setPayBusy(false) },
  });
  rzp.on('payment.failed', (r) => {
    guestNote.textContent = r.error?.description || 'Payment failed. Please try again.';
    guestNote.hidden = false;
    setPayBusy(false);
  });
  rzp.open();
}

/* ---------- step 4 → confirmation ---------- */
function showDone(booking, paid) {
  const nights = booking.nights;
  doneCard.innerHTML = `
    <div class="done__tick">✓</div>
    <span class="num">Booking ${paid ? 'confirmed & paid' : 'confirmed'}</span>
    <h2>Thank you, ${escape(booking.guestName.split(' ')[0])}.</h2>
    <div class="done__ref">${escape(booking.reference)}</div>
    <p class="lead muted" style="font-size:20px">${paid
      ? 'Your payment is in and your room is held. A confirmation is on its way to your email.'
      : 'Your room is reserved. Please settle the amount at the hotel desk on arrival.'}</p>
    <ul class="deflist">
      <li><span>Room</span><b>${escape(booking.roomName)}</b></li>
      <li><span>Check-in</span><b>${fmtDate(state.checkIn)} · from 2 PM</b></li>
      <li><span>Check-out</span><b>${fmtDate(state.checkOut)} · by 12 PM</b></li>
      <li><span>Stay</span><b>${nights} night${nights > 1 ? 's' : ''} · ${booking.rooms} room${booking.rooms > 1 ? 's' : ''} · ${booking.guests} guest(s)</b></li>
      <li><span>${paid ? 'Paid' : 'Pay at hotel'}</span><b>${rupees(booking.totalAmount)}</b></li>
    </ul>
    <div class="done__actions">
      <a href="index.html" class="btn btn--plum">Back to site</a>
      <a href="rooms.html" class="btn">Browse rooms</a>
    </div>`;
  goto('done');
  setPayBusy(false);
}

/* ---------- boot ---------- */
primeDates();
