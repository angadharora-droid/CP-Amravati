/* =========================================================
   CENTRE POINT AMRAVATI — shared shell + interactions
   Header/footer injection, scroll reveal, room-index preview,
   header hide-on-scroll, counters, parallax, headline split,
   gallery lightbox, enquiry form.
   ========================================================= */

import './theme.css';
import logoUrl from './assets/images/centre-point-logo.png';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const NAV = [
  {
    label: 'Rooms', href: 'rooms.html',
    sub: [
      ['Executive', 'rooms.html#executive'], ['Premium', 'rooms.html#premium'],
      ['Family Premium', 'rooms.html#family'], ['Club', 'rooms.html#club'],
      ['Deluxe Suite', 'rooms.html#deluxe'], ['Luxury Suite', 'rooms.html#luxury'],
    ],
  },
  { label: 'Dining', href: 'dining.html' },
  {
    label: 'Banquets & Events', href: 'banquets.html',
    sub: [['Orchid Ball Room', 'banquets.html#orchid'], ['Lotus Room', 'banquets.html#lotus'], ['The Greens', 'banquets.html#greens']],
  },
  { label: 'Amenities', href: 'amenities.html' },
  { label: 'Gallery', href: 'gallery.html' },
  { label: 'Contact', href: 'contact.html' },
];

const here = location.pathname.split('/').pop() || 'index.html';

/* ---------- header ---------- */
function buildHeader() {
  const items = NAV.map((n) => {
    const active = n.href === here ? ' class="is-active"' : '';
    const caret = n.sub ? '<i class="caret"></i>' : '';
    const sub = n.sub ? `<div class="hdr__sub">${n.sub.map(([t, h]) => `<a href="${h}">${t}</a>`).join('')}</div>` : '';
    return `<li${active}><a href="${n.href}">${n.label}${caret}</a>${sub}</li>`;
  }).join('');

  const el = document.createElement('header');
  el.className = 'hdr';
  el.innerHTML = `
    <div class="hdr__in">
      <a href="index.html" class="hdr__logo"><img src="${logoUrl}" alt="Centre Point Amravati" /></a>
      <nav><ul class="hdr__nav">${items}</ul></nav>
      <a href="book.html" class="btn btn--plum hdr__cta">Book Now</a>
      <button class="hdr__burger" id="burger" aria-label="Menu"><span></span><span></span><span></span></button>
    </div>`;
  document.body.prepend(el);
  return el;
}

function buildDrawer() {
  const groups = NAV.map((n) => {
    const head = n.sub ? `<span>${n.label}</span>` : `<a href="${n.href}">${n.label}</a>`;
    const sub = n.sub ? `<div class="drawer__s">${n.sub.map(([t, h]) => `<a href="${h}">${t}</a>`).join('')}</div>` : '';
    return `<div class="drawer__g">${head}${sub}</div>`;
  }).join('');
  const el = document.createElement('div');
  el.className = 'drawer';
  el.innerHTML = `${groups}<a href="book.html" class="btn btn--plum">Book a Room</a>`;
  document.body.appendChild(el);
  return el;
}

function buildFooter() {
  const el = document.createElement('footer');
  el.className = 'ftr';
  el.innerHTML = `
    <div class="shell ftr__top">
      <div>
        <img src="${logoUrl}" alt="Centre Point Amravati" class="ftr__logo" />
        <p class="ftr__blurb">The city's address for business and celebrations, near Chatri Talav in Dastur Nagar.</p>
      </div>
      <div>
        <h4>Explore</h4>
        <ul class="ftr__col">
          <li><a href="rooms.html">Rooms &amp; Suites</a></li>
          <li><a href="dining.html">Dining</a></li>
          <li><a href="banquets.html">Banquets &amp; Events</a></li>
          <li><a href="amenities.html">Amenities</a></li>
          <li><a href="gallery.html">Gallery</a></li>
          <li><a href="https://careers.centrepointgroup.in/" target="_blank" rel="noopener">Careers</a></li>
        </ul>
      </div>
      <div>
        <h4>Visit</h4>
        <ul class="ftr__col">
          <li>Near Chatri Talav,</li>
          <li>Dastur Nagar, Amravati</li>
          <li>Maharashtra 444606</li>
          <li style="margin-top:12px"><a href="contact.html">Get directions</a></li>
        </ul>
      </div>
      <div>
        <h4>Reservations</h4>
        <ul class="ftr__contact">
          <li><a href="tel:+919266923456">+91 92669 23456</a><em>Rooms</em></li>
          <li><a href="tel:+919763715985">+91 97637 15985</a><em>Hotel desk</em></li>
          <li><a href="mailto:gm.amravati@cpgh.in">gm.amravati@cpgh.in</a><em>Email</em></li>
        </ul>
      </div>
    </div>
    <div class="shell ftr__bar">
      <span>© <b>${new Date().getFullYear()}</b> Centre Point Amravati</span>
      <span><a href="https://www.cpgh.in">cpgh.in</a> · Part of the Centre Point group</span>
    </div>`;
  document.body.appendChild(el);
}

/* ---------- header: hide on scroll down, show on up ---------- */
function wireHeader(hdr, drawer) {
  const burger = hdr.querySelector('#burger');
  let last = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!drawer.classList.contains('open')) {
      hdr.classList.toggle('hide', y > 200 && y > last);
    }
    last = y;
  }, { passive: true });

  burger.addEventListener('click', () => {
    const open = drawer.classList.toggle('open');
    burger.classList.toggle('x', open);
    document.body.classList.toggle('lock', open);
    hdr.classList.remove('hide');
  });
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    drawer.classList.remove('open'); burger.classList.remove('x'); document.body.classList.remove('lock');
  }));
}

/* ---------- scroll reveal + counters + stagger ---------- */
function wireReveal() {
  // auto-stagger children of [data-stagger]
  document.querySelectorAll('[data-stagger]').forEach((grp) => {
    [...grp.children].forEach((c, i) => {
      if (!c.hasAttribute('data-reveal')) c.setAttribute('data-reveal', '');
      c.style.transitionDelay = `${i * 90}ms`;
    });
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.dataset.count !== undefined) runCount(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -7% 0px' });

  document.querySelectorAll('[data-reveal], [data-count]').forEach((el) => io.observe(el));
}

function runCount(el) {
  const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '', dur = 1700, start = performance.now();
  const tick = (now) => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN') + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- headline word-reveal (data-split) ---------- */
function wireSplit() {
  document.querySelectorAll('[data-split]').forEach((el) => {
    // wrap each word in an inline-block span (preserving existing tags/<br>)
    el.innerHTML = el.innerHTML.replace(/(<[^>]+>)|([^<\s]+)/g, (m, tag, word) =>
      tag ? tag : `<span class="word">${word}</span>`
    );
    el.querySelectorAll('.word').forEach((w, i) => {
      w.style.display = 'inline-block';
      w.style.transform = 'translateY(0.4em)';
      w.style.opacity = '0';
      w.style.transition = `transform 0.85s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms, opacity 0.85s ${i * 60}ms`;
    });
  });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.querySelectorAll('[data-split] .word').forEach((w) => { w.style.transform = 'none'; w.style.opacity = '1'; });
  }));
}

/* ---------- parallax on [data-parallax] ---------- */
function wireParallax() {
  const els = [...document.querySelectorAll('[data-parallax]')];
  if (!els.length) return;
  const onScroll = () => {
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      const speed = parseFloat(el.dataset.parallax) || 0.12;
      const off = (r.top + r.height / 2 - window.innerHeight / 2) * -speed;
      el.style.transform = `translate3d(0, ${off.toFixed(1)}px, 0) scale(1.12)`;
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- room index: hover a row → swap preview ---------- */
function wireRoomIndex() {
  const idx = document.querySelector('.rindex');
  if (!idx) return;
  const rows = [...idx.querySelectorAll('.rrow')];
  const imgs = [...idx.querySelectorAll('.rindex__preview img')];
  const capN = idx.querySelector('.rindex__cap b');
  const capM = idx.querySelector('.rindex__cap span');

  const activate = (i) => {
    rows.forEach((r, k) => r.classList.toggle('on', k === i));
    imgs.forEach((im, k) => im.classList.toggle('show', k === i));
    if (capN) capN.textContent = rows[i].dataset.name || rows[i].querySelector('.rrow__name').textContent;
    if (capM) capM.textContent = rows[i].dataset.cap || '';
  };
  rows.forEach((r, i) => {
    r.addEventListener('mouseenter', () => activate(i));
    r.addEventListener('click', () => { if (r.dataset.href) location.href = r.dataset.href; });
  });
  activate(0);
}

/* ---------- gallery lightbox ---------- */
function wireGallery() {
  const items = [...document.querySelectorAll('.gwall__i img')];
  if (!items.length) return;
  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.innerHTML = `<button class="lb__x" aria-label="Close">&times;</button><button class="lb__n lb__p" aria-label="Prev">&#8249;</button><img alt="" /><button class="lb__n lb__nx" aria-label="Next">&#8250;</button>`;
  document.body.appendChild(lb);
  const img = lb.querySelector('img');
  let idx = 0;
  const show = (i) => { idx = (i + items.length) % items.length; img.src = items[idx].src; };
  const open = (i) => { show(i); lb.classList.add('open'); document.body.classList.add('lock'); };
  const close = () => { lb.classList.remove('open'); document.body.classList.remove('lock'); };
  items.forEach((im, i) => im.addEventListener('click', () => open(i)));
  lb.querySelector('.lb__x').addEventListener('click', close);
  lb.querySelector('.lb__p').addEventListener('click', () => show(idx - 1));
  lb.querySelector('.lb__nx').addEventListener('click', () => show(idx + 1));
  lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
  window.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
}

/* ---------- booking search widget (rooms page) ---------- */
function wireBookWidget() {
  const w = document.getElementById('bookWidget');
  if (!w) return;
  const iso = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 2 * 86400000);

  w.checkIn.min = iso(today);
  w.checkOut.min = iso(tomorrow);
  w.checkIn.value = iso(tomorrow);
  w.checkOut.value = iso(dayAfter);

  w.checkIn.addEventListener('change', () => {
    const next = new Date(new Date(w.checkIn.value).getTime() + 86400000);
    w.checkOut.min = iso(next);
    if (w.checkOut.value <= w.checkIn.value) w.checkOut.value = iso(next);
  });

  w.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = new URLSearchParams({
      checkIn: w.checkIn.value,
      checkOut: w.checkOut.value,
      guests: w.guests.value || '2',
      rooms: w.rooms.value || '1',
    });
    location.href = `book.html?${q.toString()}`;
  });
}

/* ---------- enquiry form ---------- */
function wireEnquiry() {
  const form = document.getElementById('enquiryForm');
  if (!form) return;
  const q = new URLSearchParams(location.search);
  const pre = form.querySelector('#prefill');
  if (q.get('room') && form.topic) form.topic.value = 'A stay';
  if (q.get('topic') && form.topic) form.topic.value = q.get('topic');
  if (pre && q.get('room')) pre.value = `Enquiry about ${q.get('room')}.`;

  const note = form.querySelector('#formNote');
  const btn = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) return form.reportValidity();
    const payload = { name: form.name.value.trim(), topic: form.topic.value, contact: form.contact.value.trim(), message: form.message.value.trim() };
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…'; note.hidden = true;
    try {
      const res = await fetch(`${API}/api/enquiries`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Please try again.');
      note.textContent = `Thank you, ${payload.name.split(' ')[0]}. Your enquiry is with our desk — reference ${data.reference}.`;
      note.hidden = false; form.reset();
    } catch (err) { note.textContent = err.message; note.hidden = false; }
    finally { btn.disabled = false; btn.textContent = label; }
  });
}

/* ---------- boot ---------- */
const hdr = buildHeader();
const drawer = buildDrawer();
buildFooter();
wireHeader(hdr, drawer);
wireSplit();
wireReveal();
wireParallax();
wireRoomIndex();
wireGallery();
wireBookWidget();
wireEnquiry();
