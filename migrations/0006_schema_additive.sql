-- Index composite pour accélérer les lookups de disponibilité
CREATE INDEX IF NOT EXISTS idx_bookings_studio_date
ON bookings(studio_id, date, start_time);

-- Index sur payments.booking_id pour les jointures fréquentes
CREATE INDEX IF NOT EXISTS idx_payments_booking_id
ON payments(booking_id);

-- Index sur bookings.date pour les filtres calendrier
CREATE INDEX IF NOT EXISTS idx_bookings_date
ON bookings(date);

-- Index sur bookings.status pour les filtres liste
CREATE INDEX IF NOT EXISTS idx_bookings_status
ON bookings(status);
