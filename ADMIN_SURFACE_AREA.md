# H3 Studios - Admin Panel Surface Area & Database Schema

**Generated:** 2026-02-15  
**Status:** Complete mapping of admin panel, database schema, and public page integrations

---

## 1. ADMIN PANEL FILES (14 pages)

Located in `src/app/pages/admin/`:

| File | Purpose | Status |
|------|---------|--------|
| `Dashboard.tsx` | Admin overview + KPIs | ✓ |
| `Bookings.tsx` | List all bookings with filters | ✓ |
| `BookingDetail.tsx` | Single booking view + edit | ✓ |
| `BookingNew.tsx` | Create booking manually | ✓ |
| `Users.tsx` | Client management + blocking | ✓ |
| `UserDetail.tsx` | Single user profile + merge | ✓ |
| `Payments.tsx` | Payment tracking + refunds | ✓ |
| `Pricing.tsx` | Studio pricing per group type | ✓ |
| `Studios.tsx` | Studio management | ✓ |
| `Calendar.tsx` | Visual calendar view | ✓ |
| `BlockedSlots.tsx` | Maintenance/private events | ✓ |
| `Settings.tsx` | App configuration | ✓ |
| `AuditLog.tsx` | Admin action history | ✓ |
| `Login.tsx` | Admin authentication | ✓ |

---

## 2. DATABASE SCHEMA (13 tables)

### Core Tables

#### `admin_users` (Admin authentication)
```sql
id TEXT PRIMARY KEY
email TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
name TEXT NOT NULL
role TEXT ('super-admin' | 'operator')
is_active INTEGER DEFAULT 1
created_at TEXT
updated_at TEXT
```

#### `sessions` (Admin auth sessions)
```sql
id TEXT PRIMARY KEY
user_id TEXT NOT NULL
token TEXT UNIQUE NOT NULL
expires_at TEXT NOT NULL
created_at TEXT
```

#### `users` (Clients/Musicians)
```sql
id TEXT PRIMARY KEY
email TEXT
name TEXT NOT NULL
phone TEXT
band_name TEXT
notes TEXT
is_blocked INTEGER DEFAULT 0
total_bookings INTEGER DEFAULT 0
total_spent INTEGER DEFAULT 0
created_at TEXT
updated_at TEXT
```

#### `bookings` (Reservations)
```sql
id TEXT PRIMARY KEY
booking_ref TEXT UNIQUE NOT NULL (format: H3-YYYYMMDD-XXXX)
user_id TEXT NOT NULL
studio_id TEXT NOT NULL
date TEXT NOT NULL
start_time TEXT NOT NULL (HH:MM)
end_time TEXT NOT NULL (HH:MM)
group_type TEXT ('solo' | 'duo' | 'group')
status TEXT ('confirmed' | 'cancelled' | 'completed' | 'no-show')
base_price INTEGER NOT NULL
equipment_price INTEGER DEFAULT 0
total_price INTEGER NOT NULL
equipment TEXT (JSON array of equipment IDs)
payment_method TEXT ('card' | 'cash')
payment_status TEXT ('pending' | 'paid' | 'pay-on-site')
notes TEXT
created_at TEXT
updated_at TEXT
cancelled_at TEXT
cancel_reason TEXT
```

**Indexes:**
- `idx_bookings_date` (date)
- `idx_bookings_user_id` (user_id)
- `idx_bookings_studio_id` (studio_id)
- `idx_bookings_status` (status)
- `idx_bookings_booking_ref` (booking_ref)

#### `payments` (Payment tracking)
```sql
id TEXT PRIMARY KEY
booking_id TEXT NOT NULL
amount INTEGER NOT NULL
method TEXT ('card' | 'cash')
status TEXT ('pending' | 'paid' | 'refunded' | 'partial-refund')
refunded_amount INTEGER DEFAULT 0
paid_at TEXT
created_at TEXT
```

**Index:** `idx_payments_booking_id` (booking_id)

#### `blocked_slots` (Maintenance/private events)
```sql
id TEXT PRIMARY KEY
studio_id TEXT (NULL = all studios)
date TEXT NOT NULL
start_time TEXT NOT NULL
end_time TEXT NOT NULL
reason TEXT NOT NULL
created_at TEXT
```

**Indexes:**
- `idx_blocked_slots_date` (date)
- `idx_blocked_slots_studio_id` (studio_id)

### Configuration Tables

#### `pricing` (Per studio, per group type, peak/off-peak)
```sql
id TEXT PRIMARY KEY
studio_id TEXT NOT NULL
group_type TEXT ('solo' | 'duo' | 'group')
is_peak INTEGER (0 = off-peak, 1 = peak)
price_per_half_hour INTEGER NOT NULL
updated_at TEXT
```

**Peak hours:** 18:00+ and weekends (Sat/Sun)

#### `equipment` (Rental equipment)
```sql
id TEXT PRIMARY KEY
equipment_id TEXT UNIQUE NOT NULL
name TEXT NOT NULL
max_per_session INTEGER NOT NULL
pricing_type TEXT ('session' | 'hourly')
session_pricing TEXT (JSON)
price_per_hour INTEGER DEFAULT 0
updated_at TEXT
```

#### `opening_hours` (Per studio, per day of week)
```sql
id TEXT PRIMARY KEY
studio_id TEXT NOT NULL
day_of_week INTEGER (0-6, 0=Sunday)
open_time TEXT NOT NULL (HH:MM)
close_time TEXT NOT NULL (HH:MM)
is_closed INTEGER DEFAULT 0
```

**Index:** `idx_opening_hours_studio` (studio_id, day_of_week)

#### `promo_codes` (Discount codes)
```sql
id TEXT PRIMARY KEY
code TEXT UNIQUE NOT NULL
type TEXT ('percentage' | 'fixed')
value INTEGER NOT NULL
min_total INTEGER DEFAULT 0
is_active INTEGER DEFAULT 1
expires_at TEXT
usage_count INTEGER DEFAULT 0
max_usage INTEGER
created_at TEXT
```

**Index:** `idx_promo_codes_code` (code)

#### `settings` (Key-value configuration)
```sql
id TEXT PRIMARY KEY
key TEXT UNIQUE NOT NULL
value TEXT NOT NULL
updated_at TEXT
```

#### `audit_logs` (Admin action history)
```sql
id TEXT PRIMARY KEY
entity_type TEXT NOT NULL (e.g., 'booking', 'user', 'payment')
entity_id TEXT NOT NULL
action TEXT NOT NULL (e.g., 'create', 'update', 'delete', 'merge')
changes TEXT (JSON)
performed_by TEXT NOT NULL
created_at TEXT
```

**Indexes:**
- `idx_audit_logs_entity` (entity_type, entity_id)
- `idx_audit_logs_created_at` (created_at)

#### `google_reviews` (Google Places API cache)
```sql
id TEXT PRIMARY KEY
google_review_id TEXT UNIQUE NOT NULL
author_name TEXT NOT NULL
author_photo_url TEXT
rating INTEGER (1-5)
text TEXT
text_original TEXT
relative_time TEXT
publish_time TEXT
google_maps_uri TEXT
created_at TEXT
```

**Indexes:**
- `idx_google_reviews_rating` (rating)
- `idx_google_reviews_publish_time` (publish_time)

---

## 3. DATABASE FUNCTIONS IN `src/lib/db.ts`

### Bookings (8 functions)
- `getBookings(db, filters, page, limit)` → PaginatedResult<DbBooking>
- `getBookingById(db, id)` → DbBooking | null
- `getBookingByRef(db, ref)` → DbBooking | null
- `createBooking(db, data)` → DbBooking
- `updateBooking(db, id, data)` → { success, error? }
- `getBookingsByDate(db, date)` → DbBooking[]
- `getBookingsByDateRange(db, startDate, endDate)` → DbBooking[]
- `getBookingsByUser(db, userId)` → DbBooking[]
- `checkConflict(db, studioId, date, startTime, endTime, excludeBookingId?)` → DbBooking | null

### Users (6 functions)
- `getUsers(db, filters, page, limit)` → PaginatedResult<DbUser>
- `getUserById(db, id)` → DbUser | null
- `getUserByEmail(db, email)` → DbUser | null
- `createUser(db, data)` → DbUser
- `updateUser(db, id, data)` → { success, error? }
- `blockUser(db, userId, blocked)` → { success, error? }
- `mergeUsers(db, primaryId, duplicateIds)` → { success, error? }

### Payments (3 functions)
- `getPayments(db, page, limit)` → PaginatedResult<DbPayment>
- `getPaymentByBookingId(db, bookingId)` → DbPayment | null
- `markPaymentPaid(db, paymentId)` → { success, error? }
- `refundPayment(db, paymentId, amount)` → { success, error? }

### Blocked Slots (3 functions)
- `getBlockedSlots(db, studioId?, date?)` → DbBlockedSlot[]
- `addBlockedSlot(db, data)` → { success, id }
- `removeBlockedSlot(db, slotId)` → { success }

### Pricing (3 functions)
- `getPricing(db)` → DbPricing[]
- `updatePricing(db, id, pricePerHalfHour)` → { success }
- `getPricingForBooking(db, studioId, groupType, isPeak)` → number

### Equipment (2 functions)
- `getEquipment(db)` → DbEquipment[]
- `updateEquipment(db, id, data)` → { success }

### Promo Codes (4 functions)
- `getPromoCodes(db)` → DbPromoCode[]
- `createPromoCode(db, data)` → { success, id }
- `updatePromoCode(db, id, data)` → { success }
- `validatePromoCode(db, code, total)` → { valid, promo?, error? }

### Opening Hours (2 functions)
- `getOpeningHours(db)` → DbOpeningHours[]
- `updateOpeningHours(db, id, data)` → { success }

### Settings (3 functions)
- `getSetting(db, key)` → string | null
- `setSetting(db, key, value)` → { success }
- `getAllSettings(db)` → DbSetting[]

### Audit Logs (2 functions)
- `addAuditLog(db, entityType, entityId, action, changes, performedBy?)` → void
- `getAuditLogs(db, filters, page, limit)` → PaginatedResult<DbAuditLog>

### Dashboard (1 function)
- `getDashboardStats(db)` → DashboardStats
  - `todayBookings`, `todayRevenue`
  - `weekBookings`, `weekRevenue`
  - `monthBookings`, `monthRevenue`
  - `pendingPayments`, `pendingAmount`
  - `occupancyToday` (percentage)

---

## 4. PUBLIC PAGES (12 pages)

Located in `src/app/pages/`:

| File | Purpose | DB Integration |
|------|---------|-----------------|
| `Home.tsx` | Landing page | None |
| `Reservation.tsx` | Booking flow | Uses `getPricingForBooking`, `getBlockedSlots` |
| `Tarifs.tsx` | Pricing display | None (static) |
| `TarifsReservation.tsx` | Booking pricing info | None (static) |
| `LesStudios.tsx` | Studio showcase | None |
| `LeMateriel.tsx` | Equipment showcase | None |
| `Equipe.tsx` | Team page | None |
| `APropos.tsx` | About page | None |
| `Actualites.tsx` | News/blog | None |
| `Avis.tsx` | Google reviews | Uses `google_reviews` table (via API) |
| `PaymentSuccess.tsx` | Stripe callback | None |
| `PaymentCancel.tsx` | Stripe callback | None |

---

## 5. API ENDPOINTS IN `src/worker.tsx`

### Booking APIs
- `POST /api/bookings` - Create booking (uses `getPricingForBooking`, `getBlockedSlots`)
- `GET /api/bookings/:id` - Get booking details
- `GET /api/bookings/user/:userId` - Get user's bookings
- `GET /api/availability` - Check available slots (uses `getBlockedSlots`)

### Admin APIs (Protected)
- `GET /api/admin/bookings` - List bookings with filters
- `GET /api/admin/bookings/:id` - Booking detail
- `PUT /api/admin/bookings/:id` - Update booking
- `POST /api/admin/bookings` - Create booking
- `DELETE /api/admin/bookings/:id` - Cancel booking

- `GET /api/admin/users` - List users
- `GET /api/admin/users/:id` - User detail
- `PUT /api/admin/users/:id` - Update user
- `POST /api/admin/users` - Create user
- `POST /api/admin/users/:id/block` - Block user
- `POST /api/admin/users/merge` - Merge duplicate users

- `GET /api/admin/payments` - List payments
- `PUT /api/admin/payments/:id/mark-paid` - Mark payment as paid
- `POST /api/admin/payments/:id/refund` - Refund payment

- `GET /api/admin/blocked-slots` - List blocked slots
- `POST /api/admin/blocked-slots` - Add blocked slot
- `DELETE /api/admin/blocked-slots/:id` - Remove blocked slot

- `GET /api/admin/pricing` - List pricing
- `PUT /api/admin/pricing/:id` - Update pricing

- `GET /api/admin/equipment` - List equipment
- `PUT /api/admin/equipment/:id` - Update equipment

- `GET /api/admin/opening-hours` - List opening hours
- `PUT /api/admin/opening-hours/:id` - Update opening hours

- `GET /api/admin/settings` - List all settings
- `PUT /api/admin/settings/:key` - Update setting

- `GET /api/admin/audit-logs` - List audit logs

- `GET /api/admin/dashboard` - Dashboard stats

---

## 6. FUNCTION USAGE SUMMARY

### Functions Used in Public Pages
- **`getPricingForBooking`** - Used in `Reservation.tsx` booking flow
- **`getBlockedSlots`** - Used in `Reservation.tsx` availability check
- **`getOpeningHours`** - Used in admin APIs only (not public pages)
- **`getEquipment`** - Used in admin APIs only (not public pages)
- **`getPricing`** - Used in admin APIs only (not public pages)
- **`getAllSettings`** - Used in admin APIs only (not public pages)

### Functions Used in Admin APIs (worker.tsx)
All 6 functions are imported and used in API endpoints:
- `getPricing` → GET /api/admin/pricing
- `getEquipment` → GET /api/admin/equipment
- `getOpeningHours` → GET /api/admin/opening-hours (GET + PUT)
- `getBlockedSlots` → GET /api/admin/blocked-slots + booking availability
- `getAllSettings` → GET /api/admin/settings
- `getPricingForBooking` → POST /api/bookings (pricing calculation)

---

## 7. KEY INSIGHTS

### Database Completeness
✓ **13 tables** covering:
- Admin authentication (admin_users, sessions)
- Client management (users)
- Booking lifecycle (bookings, payments, blocked_slots)
- Configuration (pricing, equipment, opening_hours, promo_codes, settings)
- Audit trail (audit_logs)
- External data (google_reviews)

### Admin Panel Coverage
✓ **14 pages** covering:
- Dashboard (KPIs)
- Bookings (CRUD + detail view)
- Users (CRUD + blocking + merging)
- Payments (tracking + refunds)
- Configuration (pricing, equipment, hours, blocked slots, settings)
- Audit logs
- Authentication

### Public Page Integration
✓ **Minimal DB dependency** - Only 2 functions used:
- `getPricingForBooking` - For real-time pricing
- `getBlockedSlots` - For availability checking

✓ **Static content** - Most public pages use hardcoded data (no DB queries)

### API Architecture
✓ **Centralized routing** - All routes in `worker.tsx`
✓ **Consistent error handling** - Try/catch with JSON responses
✓ **Audit logging** - All admin actions tracked
✓ **Pagination** - Implemented for large datasets (bookings, users, payments, audit logs)

---

## 8. MIGRATION STATUS

| Migration | Tables | Status |
|-----------|--------|--------|
| `0001_initial_schema.sql` | 12 tables | ✓ Applied |
| `0002_google_reviews.sql` | 1 table | ✓ Applied |

**Total:** 13 tables, 18 indexes

---

## 9. TYPE DEFINITIONS

All types defined in `src/lib/db-types.ts`:
- `DbBooking`, `DbUser`, `DbPayment`, `DbBlockedSlot`
- `DbPricing`, `DbEquipment`, `DbPromoCode`
- `DbOpeningHours`, `DbSetting`, `DbAuditLog`
- `BookingFilters`, `UserFilters`, `AuditLogFilters`
- `BookingStatus`, `DbPaymentStatus`
- `PaginatedResult<T>`

---

## 10. NEXT STEPS FOR DEVELOPMENT

### If Adding New Admin Features
1. Add table to migration (if needed)
2. Add CRUD functions to `src/lib/db.ts`
3. Add types to `src/lib/db-types.ts`
4. Add API endpoints to `src/worker.tsx`
5. Add admin page to `src/app/pages/admin/`
6. Add audit logging for all mutations

### If Modifying Public Pages
1. Check if new DB queries needed
2. Add functions to `src/lib/db.ts` if required
3. Update `src/worker.tsx` API endpoints
4. Test availability/pricing calculations

### If Changing Database Schema
1. Create new migration file (0003_*.sql)
2. Update types in `src/lib/db-types.ts`
3. Update functions in `src/lib/db.ts`
4. Update API endpoints in `src/worker.tsx`
5. Run `pnpm check` to verify types
