/* =========================================================
   Hotel Centre Point Amravati — "A Day Here"
   ========================================================= */

import './styles.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5050';

/* ---------------------------------------------------------
   1. The clock + the ambient wash.
   Scroll position maps to a time of day, and the background
   colour is interpolated between the hours.
   --------------------------------------------------------- */
const hours = [...document.querySelectorAll('.hour')];
const ambient = document.getElementById('ambient');
const clockTime = document.getElementById('clockTime');
const clockLabel = document.getElementById('clockLabel');
const railLinks = [...document.querySelectorAll('#railNav a')];

// The palette of the day: dawn cream → noon light → dusk sand → night ink.
const PALETTE = {
  dawn: [248, 237, 226],
  morning: [252, 246, 239],
  midday: [255, 255, 255],
  afternoon: [240, 223, 205],
  evening: [239, 221, 201],
  night: [0, 0, 0],
  stay: [0, 0, 0],
};

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

function paintTheDay() {
  const mid = window.innerHeight / 2;

  // Which two sections is the viewport's midline between?
  let active = hours[0];
  for (const h of hours) {
    if (h.getBoundingClientRect().top <= mid) active = h;
  }

  const i = hours.indexOf(active);
  const next = hours[i + 1] || active;
  const box = active.getBoundingClientRect();

  // 0 → 1 progress through the active section
  const t = Math.min(Math.max((mid - box.top) / box.height, 0), 1);

  const from = PALETTE[active.id] || PALETTE.dawn;
  const to = PALETTE[next.id] || from;
  ambient.style.backgroundColor = rgb(mix(from, to, t));

  // Clock reads the hour we're standing in.
  clockTime.textContent = `${active.dataset.hour}:00`;
  clockLabel.textContent = active.dataset.label;

  railLinks.forEach((a) =>
    a.classList.toggle('is-on', a.getAttribute('href') === `#${active.id}`)
  );
}

let ticking = false;
window.addEventListener(
  'scroll',
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      paintTheDay();
      ticking = false;
    });
  },
  { passive: true }
);
window.addEventListener('resize', paintTheDay);
paintTheDay();

/* ---------------------------------------------------------
   2. Mobile rail
   --------------------------------------------------------- */
const railToggle = document.getElementById('railToggle');
const railNav = document.querySelector('.rail__nav');

railToggle.addEventListener('click', () => {
  railNav.classList.toggle('is-open');
  railToggle.classList.toggle('is-open');
});
railLinks.forEach((a) =>
  a.addEventListener('click', () => {
    railNav.classList.remove('is-open');
    railToggle.classList.remove('is-open');
  })
);

/* ---------------------------------------------------------
   3. Rooms rail — drag to scroll, with a progress hairline
   --------------------------------------------------------- */
const track = document.getElementById('roomsTrack');
const bar = document.getElementById('roomsBar');

let down = false;
let startX = 0;
let startScroll = 0;

track.addEventListener('pointerdown', (e) => {
  down = true;
  startX = e.clientX;
  startScroll = track.scrollLeft;
  track.classList.add('is-dragging');
  track.setPointerCapture(e.pointerId);
});

track.addEventListener('pointermove', (e) => {
  if (!down) return;
  track.scrollLeft = startScroll - (e.clientX - startX);
});

const release = () => {
  down = false;
  track.classList.remove('is-dragging');
};
track.addEventListener('pointerup', release);
track.addEventListener('pointercancel', release);

track.addEventListener(
  'scroll',
  () => {
    const max = track.scrollWidth - track.clientWidth;
    const pct = max > 0 ? (track.scrollLeft / max) * 80 + 20 : 100;
    bar.style.width = `${pct}%`;
  },
  { passive: true }
);

/* ---------------------------------------------------------
   4. The venue picker — guest count chooses the hall
   --------------------------------------------------------- */
// Capacities are the theatre-format maximums from the hotel fact sheet; `max`
// is the largest guest count each space can take in its most generous layout.
const VENUES = [
  {
    max: 120,
    name: 'Lotus Room',
    desc: 'The first-floor room. The smallest of the three, and the one you book when the guest list is a considered one.',
    area: '3,000 sq ft',
    theatre: '100 – 120',
    reception: '85 – 100',
    cluster: '55 – 65',
  },
  {
    max: 600,
    name: 'Orchid Ball Room',
    desc: 'The ground-floor ball room, with a pre-function area of its own to gather in first.',
    area: '8,500 sq ft',
    theatre: '550 – 600',
    reception: '480 – 520',
    cluster: '300 – 330',
  },
  {
    max: 1500,
    name: 'The Greens',
    desc: 'The lawn. Fifteen thousand square feet with no ceiling on it — the largest single space at the hotel.',
    area: '15,000 sq ft',
    theatre: '1,400 – 1,500',
    reception: '1,200 – 1,300',
    cluster: '700 – 800',
  },
  {
    max: 1800,
    name: 'The Greens + Orchid, combined',
    desc: 'The lawn, the pre-function area and the ball room thrown open into one another. The whole city, if you like.',
    area: '23,500 sq ft',
    theatre: '1,700 – 1,800',
    reception: '1,450 – 1,550',
    cluster: '850 – 950',
  },
];

const slider = document.getElementById('guestSlider');
const guestCount = document.getElementById('guestCount');
const result = document.getElementById('venueResult');
const vName = document.getElementById('venueName');
const vDesc = document.getElementById('venueDesc');
const vArea = document.getElementById('venueArea');
const vTheatre = document.getElementById('venueTheatre');
const vReception = document.getElementById('venueReception');
const vCluster = document.getElementById('venueCluster');

let showing = null;

function pickVenue() {
  const n = Number(slider.value);
  guestCount.textContent = n.toLocaleString('en-IN');

  const v = VENUES.find((x) => n <= x.max) || VENUES[VENUES.length - 1];
  if (v.name === showing) return;

  // Fade the panel out, swap the copy, fade it back in.
  result.classList.add('is-swapping');
  setTimeout(() => {
    vName.textContent = v.name;
    vDesc.textContent = v.desc;
    vArea.textContent = v.area;
    vTheatre.textContent = v.theatre;
    vReception.textContent = v.reception;
    vCluster.textContent = v.cluster;
    result.classList.remove('is-swapping');
  }, 220);

  showing = v.name;
}

slider.addEventListener('input', pickVenue);
pickVenue();

/* ---------------------------------------------------------
   5. Voices — rotate the guest quotes
   --------------------------------------------------------- */
const voices = [...document.querySelectorAll('.voice')];
let vi = 0;
setInterval(() => {
  voices[vi].classList.remove('is-on');
  vi = (vi + 1) % voices.length;
  voices[vi].classList.add('is-on');
}, 5200);

/* ---------------------------------------------------------
   6. The sentence — an enquiry, not a booking
   --------------------------------------------------------- */
const form = document.getElementById('enquiryForm');
const sent = document.getElementById('sent');
const hint = document.getElementById('hint');
const sendBtn = form.querySelector('.send');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!form.checkValidity()) return form.reportValidity();

  const payload = {
    name: document.getElementById('fName').value.trim(),
    topic: document.getElementById('fTopic').value,
    contact: document.getElementById('fContact').value.trim(),
    message: document.getElementById('fMessage').value.trim(),
  };

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending…';
  sent.hidden = true;

  try {
    const res = await fetch(`${API}/api/enquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'The desk did not pick up. Please try again.');

    sent.textContent = `Thank you, ${payload.name.split(' ')[0]}. Your message is with the desk — reference ${data.reference}.`;
    sent.hidden = false;
    hint.textContent = '';
    form.reset();
  } catch (err) {
    sent.textContent = err.message;
    sent.hidden = false;
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send it to the desk';
  }
});

/* ---------------------------------------------------------
   7. Reveal on scroll
   --------------------------------------------------------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
);

document
  .querySelectorAll('.stamp, .display, .standfirst, .dawn__meta, .services, .picker, .plainlist, .water, .night__grid, .sentence, .finder')
  .forEach((el, i) => {
    el.classList.add('rv');
    el.style.transitionDelay = `${(i % 3) * 100}ms`;
    io.observe(el);
  });

document.getElementById('year').textContent = new Date().getFullYear();
