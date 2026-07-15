import RoomType from '../models/RoomType.js';

/* The six categories the hotel sells. Counts are the hotel's live inventory
   (Executive 6, Premium 46, Family 6, Club 3, Deluxe 1 = 62 currently-sellable
   rooms; the Luxury Suite is held offline at 0 until it is released).
   Prices are placeholder launch rates (₹ per room, per night) — edit them in
   The Desk once the real rate card is set. Images reuse the site's plates. */
const ROOMS = [
  {
    name: 'Executive Room', slug: 'executive', sortOrder: 1,
    size: '180 sq ft', maxOccupancy: 2, basePrice: 3200, totalRooms: 6,
    roomNumbers: ['216', '217', '316', '416', '417', '516'],
    image: '/images/executive-room.jpeg',
    description: 'Sleek design and modern convenience, for the diligent business traveller who is here to get things done.',
    amenities: ['Free Wi-Fi', 'Work desk', 'AC', 'Tea/coffee'],
  },
  {
    name: 'Premium Room', slug: 'premium', sortOrder: 2,
    size: '250 sq ft', maxOccupancy: 2, basePrice: 4200, totalRooms: 46,
    roomNumbers: [
      '201', '202', '203', '204', '205', '207', '209', '210', '211', '212', '214',
      '301', '302', '303', '304', '305', '307', '309', '310', '311', '312', '314',
      '401', '402', '403', '404', '405', '407', '409', '410', '411', '412', '414',
      '501', '502', '503', '504', '505', '506', '507', '508', '509', '510', '511', '512', '514',
    ],
    image: '/images/premium-room.jpeg',
    description: 'Elegant décor combined with cosy seating — the hotel’s mainstay, a room you may not want to leave.',
    amenities: ['Free Wi-Fi', 'Cosy seating', 'AC', 'Mini fridge', 'Tea/coffee'],
  },
  {
    name: 'Family Premium', slug: 'family', sortOrder: 3,
    size: '325 sq ft', maxOccupancy: 4, basePrice: 5600, totalRooms: 6,
    roomNumbers: ['206', '208', '306', '308', '406', '408'],
    image: '/images/family-premium.jpeg',
    description: 'Made for families or small groups, with two king beds and the extra space so the room never feels cramped.',
    amenities: ['Free Wi-Fi', '2 king beds', 'AC', 'Mini fridge', 'Tea/coffee'],
  },
  {
    name: 'Club Room', slug: 'club', sortOrder: 4,
    size: '400 sq ft', maxOccupancy: 3, basePrice: 6400, totalRooms: 3,
    roomNumbers: ['215', '415', '515'],
    image: '/images/room-view.jpeg',
    description: 'A higher category for guests who want a more premium stay — the long stay, or simply that bit more comfort.',
    amenities: ['Free Wi-Fi', 'Lounge chair', 'AC', 'Mini bar', 'Bathrobe'],
  },
  {
    name: 'Deluxe Suite', slug: 'deluxe', sortOrder: 5,
    size: '600 sq ft', maxOccupancy: 3, basePrice: 9500, totalRooms: 1,
    roomNumbers: ['315'],
    image: '/images/deluxe-room.jpeg',
    description: 'A suite with a separate living room and bedroom — more space, and a more premium experience for the stay.',
    amenities: ['Free Wi-Fi', 'Separate living room', 'AC', 'Mini bar', 'Bathrobe', 'Kettle'],
  },
  {
    name: 'Luxury Suite', slug: 'luxury', sortOrder: 6,
    size: '800 sq ft', maxOccupancy: 4, basePrice: 14500, totalRooms: 0, active: false,
    roomNumbers: [],
    image: '/images/suite-lounge-portrait.jpeg',
    description: 'The top category — the most spacious stay, with a separate guest room, living room, dining space and a powder room of its own.',
    amenities: ['Free Wi-Fi', 'Guest + living + dining', 'AC', 'Mini bar', 'Bathrobe', 'Powder room'],
  },
];

/** Insert the room types once, on an empty collection. Never overwrites edits. */
export async function seedRooms() {
  const count = await RoomType.estimatedDocumentCount();
  if (count > 0) return;
  await RoomType.insertMany(ROOMS);
  console.log(`Seeded ${ROOMS.length} room types (${ROOMS.reduce((n, r) => n + r.totalRooms, 0)} rooms).`);
}

// Allow `node src/scripts/seedRooms.js` to run it standalone.
if (import.meta.url === `file://${process.argv[1]}`) {
  const dotenvx = (await import('@dotenvx/dotenvx')).default;
  dotenvx.config();
  const { connectDB } = await import('../config/db.js');
  await connectDB();
  await seedRooms();
  process.exit(0);
}
