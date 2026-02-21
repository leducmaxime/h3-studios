UPDATE bookings
SET band_name = NULL
WHERE created_at < (
  SELECT applied_at
  FROM d1_migrations
  WHERE name = '0002_bookings_band_name.sql'
  LIMIT 1
);
