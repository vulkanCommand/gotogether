INSERT INTO users (firebase_uid, email, name)
VALUES
('seed_uid_kalyan', 'kalyan@example.com', 'Kalyan'),
('seed_uid_ravi', 'ravi@example.com', 'Ravi'),
('seed_uid_sai', 'sai@example.com', 'Sai'),
('seed_uid_ajay', 'ajay@example.com', 'Ajay'),
('seed_uid_neha', 'neha@example.com', 'Neha')
ON CONFLICT (firebase_uid) DO NOTHING;

INSERT INTO trips (name, destination, start_date, end_date, created_by)
VALUES
(
  'Smoky Mountains Escape',
  'Gatlinburg',
  '2026-05-24',
  '2026-05-27',
  (SELECT id FROM users WHERE firebase_uid = 'seed_uid_kalyan')
),
(
  'Miami Weekend Run',
  'Miami Beach',
  '2026-06-07',
  '2026-06-09',
  (SELECT id FROM users WHERE firebase_uid = 'seed_uid_ravi')
),
(
  'Seattle City Sprint',
  'Seattle',
  '2026-07-12',
  '2026-07-15',
  (SELECT id FROM users WHERE firebase_uid = 'seed_uid_sai')
)
ON CONFLICT DO NOTHING;

INSERT INTO trip_members (trip_id, user_id, role)
SELECT t.id, u.id, x.role
FROM (
  VALUES
    ('Smoky Mountains Escape', 'seed_uid_kalyan', 'lead'),
    ('Smoky Mountains Escape', 'seed_uid_ravi', 'member'),
    ('Smoky Mountains Escape', 'seed_uid_sai', 'member'),
    ('Smoky Mountains Escape', 'seed_uid_neha', 'member'),

    ('Miami Weekend Run', 'seed_uid_ravi', 'lead'),
    ('Miami Weekend Run', 'seed_uid_kalyan', 'member'),
    ('Miami Weekend Run', 'seed_uid_ajay', 'member'),

    ('Seattle City Sprint', 'seed_uid_sai', 'lead'),
    ('Seattle City Sprint', 'seed_uid_neha', 'member'),
    ('Seattle City Sprint', 'seed_uid_ajay', 'member')
) AS x(trip_name, firebase_uid, role)
JOIN trips t ON t.name = x.trip_name
JOIN users u ON u.firebase_uid = x.firebase_uid
ON CONFLICT (trip_id, user_id) DO NOTHING;

INSERT INTO trip_destination_votes (
  trip_id,
  destination_id,
  destination_name,
  destination_country,
  destination_emoji,
  voted_by_user_id
)
SELECT
  t.id,
  x.destination_id,
  x.destination_name,
  x.destination_country,
  x.destination_emoji,
  u.id
FROM (
  VALUES
    ('Smoky Mountains Escape', 'gatlinburg', 'Gatlinburg', 'USA', '🏔️', 'seed_uid_kalyan'),
    ('Smoky Mountains Escape', 'gatlinburg', 'Gatlinburg', 'USA', '🏔️', 'seed_uid_ravi'),
    ('Smoky Mountains Escape', 'asheville', 'Asheville', 'USA', '🌲', 'seed_uid_sai'),

    ('Miami Weekend Run', 'miami', 'Miami Beach', 'USA', '🏝️', 'seed_uid_ravi'),
    ('Miami Weekend Run', 'miami', 'Miami Beach', 'USA', '🏝️', 'seed_uid_kalyan'),
    ('Miami Weekend Run', 'keywest', 'Key West', 'USA', '🌊', 'seed_uid_ajay'),

    ('Seattle City Sprint', 'seattle', 'Seattle', 'USA', '🌆', 'seed_uid_sai'),
    ('Seattle City Sprint', 'seattle', 'Seattle', 'USA', '🌆', 'seed_uid_neha'),
    ('Seattle City Sprint', 'portland', 'Portland', 'USA', '☕', 'seed_uid_ajay')
) AS x(trip_name, destination_id, destination_name, destination_country, destination_emoji, firebase_uid)
JOIN trips t ON t.name = x.trip_name
JOIN users u ON u.firebase_uid = x.firebase_uid;

INSERT INTO itinerary_days (trip_id, title, date_label, day_order)
SELECT t.id, x.title, x.date_label, x.day_order
FROM (
  VALUES
    ('Smoky Mountains Escape', 'Arrival + Cabin Check-in', 'May 24', 1),
    ('Smoky Mountains Escape', 'National Park Day', 'May 25', 2),
    ('Smoky Mountains Escape', 'Downtown + Dinner', 'May 26', 3),

    ('Miami Weekend Run', 'Beach + Brunch', 'Jun 7', 1),
    ('Miami Weekend Run', 'Nightlife + Bayside', 'Jun 8', 2),

    ('Seattle City Sprint', 'Downtown + Pike Place', 'Jul 12', 1),
    ('Seattle City Sprint', 'Space Needle + Museum', 'Jul 13', 2),
    ('Seattle City Sprint', 'Coffee + Ferry', 'Jul 14', 3)
) AS x(trip_name, title, date_label, day_order)
JOIN trips t ON t.name = x.trip_name;

INSERT INTO itinerary_events (
  itinerary_day_id,
  title,
  time_label,
  location,
  notes,
  status,
  attendee_summary,
  event_order
)
SELECT d.id, x.title, x.time_label, x.location, x.notes, x.status, x.attendee_summary, x.event_order
FROM (
  VALUES
    ('Smoky Mountains Escape', 1, 'Cabin Check-in', '3:00 PM', 'Pine Ridge Cabin', 'Pick up groceries on the way', 'confirmed', '4 attending', 1),
    ('Smoky Mountains Escape', 1, 'Welcome Dinner', '7:30 PM', 'Cabin Deck', 'BBQ night', 'confirmed', '4 attending', 2),
    ('Smoky Mountains Escape', 2, 'Hike Trail Loop', '8:00 AM', 'Great Smoky Mountains', 'Start early for parking', 'upcoming', '4 attending', 1),
    ('Smoky Mountains Escape', 2, 'Lunch Stop', '1:00 PM', 'Mountain View Cafe', 'Casual stop', 'upcoming', '4 attending', 2),
    ('Smoky Mountains Escape', 3, 'Downtown Walk', '5:00 PM', 'Gatlinburg Strip', 'Souvenirs and photos', 'upcoming', '4 attending', 1),

    ('Miami Weekend Run', 1, 'Beach Chill', '10:00 AM', 'South Beach', 'Umbrellas and towels', 'confirmed', '3 attending', 1),
    ('Miami Weekend Run', 1, 'Brunch', '1:00 PM', 'Ocean Drive', 'Reservation under Ravi', 'confirmed', '3 attending', 2),
    ('Miami Weekend Run', 2, 'Bayside Visit', '4:00 PM', 'Bayside Marketplace', 'Shopping + photos', 'upcoming', '3 attending', 1),

    ('Seattle City Sprint', 1, 'Pike Place Market', '9:00 AM', 'Downtown Seattle', 'Coffee first', 'confirmed', '3 attending', 1),
    ('Seattle City Sprint', 2, 'Space Needle', '11:00 AM', 'Seattle Center', 'Buy tickets in advance', 'upcoming', '3 attending', 1),
    ('Seattle City Sprint', 3, 'Ferry Ride', '2:00 PM', 'Seattle Waterfront', 'Weather check needed', 'upcoming', '3 attending', 1)
) AS x(trip_name, day_order, title, time_label, location, notes, status, attendee_summary, event_order)
JOIN trips t ON t.name = x.trip_name
JOIN itinerary_days d ON d.trip_id = t.id AND d.day_order = x.day_order;

INSERT INTO expenses (trip_id, title, amount, paid_by_user_id, split_method, notes)
SELECT t.id, x.title, x.amount, u.id, x.split_method, x.notes
FROM (
  VALUES
    ('Smoky Mountains Escape', 'Cabin Booking', 420.00, 'seed_uid_kalyan', 'equal', '3 nights cabin rental'),
    ('Smoky Mountains Escape', 'Groceries', 96.50, 'seed_uid_ravi', 'equal', 'Snacks and breakfast'),
    ('Smoky Mountains Escape', 'Gas', 64.00, 'seed_uid_sai', 'equal', 'Road trip fuel'),

    ('Miami Weekend Run', 'Hotel Deposit', 280.00, 'seed_uid_ravi', 'equal', 'Beach hotel'),
    ('Miami Weekend Run', 'Dinner', 135.75, 'seed_uid_kalyan', 'custom', 'Dinner by the water'),

    ('Seattle City Sprint', 'Museum Tickets', 108.00, 'seed_uid_sai', 'equal', 'Group entry'),
    ('Seattle City Sprint', 'Coffee Run', 28.50, 'seed_uid_neha', 'equal', 'Morning stop')
) AS x(trip_name, title, amount, firebase_uid, split_method, notes)
JOIN trips t ON t.name = x.trip_name
JOIN users u ON u.firebase_uid = x.firebase_uid;

INSERT INTO expense_splits (expense_id, user_id, amount)
SELECT e.id, u.id, x.amount
FROM (
  VALUES
    ('Cabin Booking', 'seed_uid_kalyan', 105.00),
    ('Cabin Booking', 'seed_uid_ravi', 105.00),
    ('Cabin Booking', 'seed_uid_sai', 105.00),
    ('Cabin Booking', 'seed_uid_neha', 105.00),

    ('Groceries', 'seed_uid_kalyan', 24.13),
    ('Groceries', 'seed_uid_ravi', 24.12),
    ('Groceries', 'seed_uid_sai', 24.12),
    ('Groceries', 'seed_uid_neha', 24.13),

    ('Gas', 'seed_uid_kalyan', 21.33),
    ('Gas', 'seed_uid_ravi', 21.33),
    ('Gas', 'seed_uid_sai', 21.34),

    ('Hotel Deposit', 'seed_uid_ravi', 93.34),
    ('Hotel Deposit', 'seed_uid_kalyan', 93.33),
    ('Hotel Deposit', 'seed_uid_ajay', 93.33),

    ('Dinner', 'seed_uid_ravi', 60.75),
    ('Dinner', 'seed_uid_kalyan', 45.00),
    ('Dinner', 'seed_uid_ajay', 30.00),

    ('Museum Tickets', 'seed_uid_sai', 36.00),
    ('Museum Tickets', 'seed_uid_neha', 36.00),
    ('Museum Tickets', 'seed_uid_ajay', 36.00),

    ('Coffee Run', 'seed_uid_sai', 9.50),
    ('Coffee Run', 'seed_uid_neha', 9.50),
    ('Coffee Run', 'seed_uid_ajay', 9.50)
) AS x(expense_title, firebase_uid, amount)
JOIN expenses e ON e.title = x.expense_title
JOIN users u ON u.firebase_uid = x.firebase_uid;

INSERT INTO trip_photos (trip_id, image_url, caption, uploaded_by_user_id, sort_order)
SELECT t.id, x.image_url, x.caption, u.id, x.sort_order
FROM (
  VALUES
    ('Smoky Mountains Escape', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb', 'Cabin view', 'seed_uid_kalyan', 1),
    ('Smoky Mountains Escape', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee', 'Mountain morning', 'seed_uid_ravi', 2),
    ('Miami Weekend Run', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e', 'Beach day', 'seed_uid_ravi', 1),
    ('Miami Weekend Run', 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda', 'Ocean sunset', 'seed_uid_kalyan', 2),
    ('Seattle City Sprint', 'https://images.unsplash.com/photo-1502175353174-a7a70e73b362', 'City skyline', 'seed_uid_sai', 1),
    ('Seattle City Sprint', 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa', 'Ferry ride', 'seed_uid_neha', 2)
) AS x(trip_name, image_url, caption, firebase_uid, sort_order)
JOIN trips t ON t.name = x.trip_name
JOIN users u ON u.firebase_uid = x.firebase_uid;
