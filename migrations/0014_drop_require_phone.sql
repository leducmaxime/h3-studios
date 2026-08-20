-- Remove the unused booking.require_phone setting. Phone remains always required.
DELETE FROM settings WHERE key = 'booking.require_phone';
