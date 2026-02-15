# H3 Studios - Admin Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE WORKERS                                 │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        src/worker.tsx                                │  │
│  │                    (ALL ROUTES + API HANDLERS)                       │  │
│  │                                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │ PUBLIC ROUTES (Client-facing)                              │   │  │
│  │  │ ─────────────────────────────────────────────────────────  │   │  │
│  │  │ GET  /                    → Home.tsx                       │   │  │
│  │  │ GET  /reservation         → Reservation.tsx               │   │  │
│  │  │ GET  /tarifs              → Tarifs.tsx                    │   │  │
│  │  │ GET  /avis                → Avis.tsx                      │   │  │
│  │  │ POST /api/bookings        → Create booking                │   │  │
│  │  │ GET  /api/availability    → Check slots (getBlockedSlots) │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │ ADMIN ROUTES (Protected by auth middleware)                │   │  │
│  │  │ ─────────────────────────────────────────────────────────  │   │  │
│  │  │ GET  /admin                → AdminDashboard.tsx            │   │  │
│  │  │ GET  /api/admin/bookings   → getBookings()                │   │  │
│  │  │ GET  /api/admin/users      → getUsers()                   │   │  │
│  │  │ GET  /api/admin/payments   → getPayments()                │   │  │
│  │  │ GET  /api/admin/pricing    → getPricing()                 │   │  │
│  │  │ GET  /api/admin/equipment  → getEquipment()               │   │  │
│  │  │ GET  /api/admin/hours      → getOpeningHours()            │   │  │
│  │  │ GET  /api/admin/settings   → getAllSettings()             │   │  │
│  │  │ GET  /api/admin/audit-logs → getAuditLogs()               │   │  │
│  │  │ GET  /api/admin/dashboard  → getDashboardStats()          │   │  │
│  │  │ ... (CRUD endpoints for all entities)                     │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    src/lib/db.ts                                     │  │
│  │              (DATABASE ABSTRACTION LAYER)                            │  │
│  │                                                                      │  │
│  │  Bookings (9)  │ Users (7)  │ Payments (4)  │ Blocked Slots (3)    │  │
│  │  ─────────────────────────────────────────────────────────────────  │  │
│  │  • getBookings()           • getUsers()      • getPayments()        │  │
│  │  • getBookingById()        • getUserById()   • getPaymentByBooking()│  │
│  │  • createBooking()         • createUser()    • markPaymentPaid()    │  │
│  │  • updateBooking()         • updateUser()    • refundPayment()      │  │
│  │  • getBookingsByDate()     • blockUser()                            │  │
│  │  • getBookingsByUser()     • mergeUsers()    • getBlockedSlots()    │  │
│  │  • checkConflict()                           • addBlockedSlot()     │  │
│  │  • getBookingByRef()                         • removeBlockedSlot()  │  │
│  │  • getBookingsByDateRange()                                         │  │
│  │                                                                      │  │
│  │  Pricing (3)   │ Equipment (2) │ Promo Codes (4) │ Hours (2)       │  │
│  │  ─────────────────────────────────────────────────────────────────  │  │
│  │  • getPricing()            • getEquipment()  • getPromoCodes()      │  │
│  │  • updatePricing()         • updateEquipment()• createPromoCode()   │  │
│  │  • getPricingForBooking()                    • updatePromoCode()    │  │
│  │                                              • validatePromoCode()  │  │
│  │                                                                      │  │
│  │  Settings (3)  │ Audit Logs (2) │ Dashboard (1)                    │  │
│  │  ─────────────────────────────────────────────────────────────────  │  │
│  │  • getSetting()            • addAuditLog()   • getDashboardStats()  │  │
│  │  • setSetting()            • getAuditLogs()                         │  │
│  │  • getAllSettings()                                                 │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                        ┌───────────────────────┐
                        │   CLOUDFLARE D1       │
                        │   (SQLite Database)   │
                        └───────────────────────┘
                                    ↓
                    ┌───────────────────────────────────┐
                    │  13 Tables (see schema below)      │
                    └───────────────────────────────────┘
```

---

## Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE D1 DATABASE                              │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ AUTHENTICATION & SESSIONS                                            │  │
│  │ ──────────────────────────────────────────────────────────────────   │  │
│  │                                                                      │  │
│  │  admin_users                          sessions                      │  │
│  │  ─────────────────────────────────    ──────────────────────────   │  │
│  │  id (PK)                              id (PK)                       │  │
│  │  email (UNIQUE)                       user_id (FK → admin_users)    │  │
│  │  password_hash                        token (UNIQUE)                │  │
│  │  name                                 expires_at                    │  │
│  │  role (super-admin|operator)          created_at                    │  │
│  │  is_active                                                          │  │
│  │  created_at, updated_at               idx_sessions_token           │  │
│  │                                       idx_sessions_user_id         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ CORE BUSINESS ENTITIES                                               │  │
│  │ ──────────────────────────────────────────────────────────────────   │  │
│  │                                                                      │  │
│  │  users                                bookings                      │  │
│  │  ──────────────────────────────────   ──────────────────────────   │  │
│  │  id (PK)                              id (PK)                       │  │
│  │  email                                booking_ref (UNIQUE)          │  │
│  │  name                                 user_id (FK → users)          │  │
│  │  phone                                studio_id                     │  │
│  │  band_name                            date                          │  │
│  │  notes                                start_time, end_time          │  │
│  │  is_blocked                           group_type                    │  │
│  │  total_bookings                       status (confirmed|cancelled)  │  │
│  │  total_spent                          base_price, equipment_price   │  │
│  │  created_at, updated_at               total_price                   │  │
│  │                                       equipment (JSON)              │  │
│  │  idx_users_email                      payment_method, payment_status│  │
│  │                                       notes, cancelled_at           │  │
│  │                                       created_at, updated_at        │  │
│  │                                                                      │  │
│  │                                       idx_bookings_date             │  │
│  │                                       idx_bookings_user_id          │  │
│  │                                       idx_bookings_studio_id        │  │
│  │                                       idx_bookings_status           │  │
│  │                                       idx_bookings_booking_ref      │  │
│  │                                                                      │  │
│  │  payments                             blocked_slots                 │  │
│  │  ──────────────────────────────────   ──────────────────────────   │  │
│  │  id (PK)                              id (PK)                       │  │
│  │  booking_id (FK → bookings)           studio_id (nullable)          │  │
│  │  amount                                date                          │  │
│  │  method (card|cash)                   start_time, end_time          │  │
│  │  status (pending|paid|refunded)       reason                        │  │
│  │  refunded_amount                      created_at                    │  │
│  │  paid_at                                                            │  │
│  │  created_at                           idx_blocked_slots_date        │  │
│  │                                       idx_blocked_slots_studio_id   │  │
│  │  idx_payments_booking_id                                            │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ CONFIGURATION & SETTINGS                                             │  │
│  │ ──────────────────────────────────────────────────────────────────   │  │
│  │                                                                      │  │
│  │  pricing                              equipment                     │  │
│  │  ──────────────────────────────────   ──────────────────────────   │  │
│  │  id (PK)                              id (PK)                       │  │
│  │  studio_id                            equipment_id (UNIQUE)         │  │
│  │  group_type (solo|duo|group)          name                          │  │
│  │  is_peak (0|1)                        max_per_session               │  │
│  │  price_per_half_hour                  pricing_type (session|hourly) │  │
│  │  updated_at                           session_pricing (JSON)        │  │
│  │                                       price_per_hour                │  │
│  │                                       updated_at                    │  │
│  │                                                                      │  │
│  │  opening_hours                        promo_codes                   │  │
│  │  ──────────────────────────────────   ──────────────────────────   │  │
│  │  id (PK)                              id (PK)                       │  │
│  │  studio_id                            code (UNIQUE)                 │  │
│  │  day_of_week (0-6)                    type (percentage|fixed)       │  │
│  │  open_time                            value                         │  │
│  │  close_time                           min_total                     │  │
│  │  is_closed                            is_active                     │  │
│  │                                       expires_at                    │  │
│  │  idx_opening_hours_studio             usage_count, max_usage        │  │
│  │                                       created_at                    │  │
│  │                                                                      │  │
│  │                                       idx_promo_codes_code          │  │
│  │                                                                      │  │
│  │  settings                                                            │  │
│  │  ──────────────────────────────────                                 │  │
│  │  id (PK)                                                            │  │
│  │  key (UNIQUE)                                                       │  │
│  │  value                                                              │  │
│  │  updated_at                                                         │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ AUDIT & EXTERNAL DATA                                                │  │
│  │ ──────────────────────────────────────────────────────────────────   │  │
│  │                                                                      │  │
│  │  audit_logs                           google_reviews                │  │
│  │  ──────────────────────────────────   ──────────────────────────   │  │
│  │  id (PK)                              id (PK)                       │  │
│  │  entity_type                          google_review_id (UNIQUE)     │  │
│  │  entity_id                            author_name                   │  │
│  │  action                                author_photo_url              │  │
│  │  changes (JSON)                       rating (1-5)                  │  │
│  │  performed_by                         text, text_original           │  │
│  │  created_at                           relative_time                 │  │
│  │                                       publish_time                  │  │
│  │  idx_audit_logs_entity                google_maps_uri               │  │
│  │  idx_audit_logs_created_at            created_at                    │  │
│  │                                                                      │  │
│  │                                       idx_google_reviews_rating     │  │
│  │                                       idx_google_reviews_publish_time│  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Admin Panel Page Hierarchy

```
/admin (Protected by auth middleware)
│
├── Dashboard.tsx
│   └── Displays: todayBookings, weekRevenue, pendingPayments, occupancyToday
│       Uses: getDashboardStats()
│
├── Bookings.tsx
│   ├── List view with filters (status, studio, date range, search)
│   ├── Uses: getBookings(filters, page, limit)
│   └── Actions: View detail, Edit, Cancel, Create new
│
├── BookingDetail.tsx
│   ├── Single booking view
│   ├── Uses: getBookingById(), getUsers(), getEquipment()
│   └── Actions: Edit dates/times, Add notes, Mark paid, Refund
│
├── BookingNew.tsx
│   ├── Manual booking creation
│   ├── Uses: checkConflict(), getPricingForBooking(), createBooking()
│   └── Actions: Select user, studio, date/time, equipment, payment method
│
├── Users.tsx
│   ├── List view with filters (search, blocked status)
│   ├── Uses: getUsers(filters, page, limit)
│   └── Actions: View detail, Block/Unblock, Create new
│
├── UserDetail.tsx
│   ├── Single user profile
│   ├── Uses: getUserById(), getBookingsByUser()
│   └── Actions: Edit info, Block, Merge with duplicates
│
├── Payments.tsx
│   ├── List view of all payments
│   ├── Uses: getPayments(page, limit)
│   └── Actions: Mark paid, Refund, View booking
│
├── Pricing.tsx
│   ├── Pricing matrix (studio × group_type × peak/off-peak)
│   ├── Uses: getPricing()
│   └── Actions: Edit price_per_half_hour
│
├── Studios.tsx
│   ├── Studio management (La Scene, Le Podium)
│   └── Actions: View info, Edit details
│
├── Calendar.tsx
│   ├── Visual calendar view of bookings
│   ├── Uses: getBookingsByDateRange()
│   └── Actions: Click to view/edit booking
│
├── BlockedSlots.tsx
│   ├── List of blocked time slots
│   ├── Uses: getBlockedSlots()
│   └── Actions: Add slot, Remove slot
│
├── Settings.tsx
│   ├── App configuration (key-value pairs)
│   ├── Uses: getAllSettings(), setSetting()
│   └── Actions: Edit any setting
│
├── AuditLog.tsx
│   ├── Admin action history
│   ├── Uses: getAuditLogs(filters, page, limit)
│   └── Filters: entity_type, action, date range
│
└── Login.tsx
    └── Admin authentication (email + password)
```

---

## Data Flow: Booking Creation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PUBLIC BOOKING FLOW (Reservation.tsx)                                       │
└─────────────────────────────────────────────────────────────────────────────┘

User fills booking form
        ↓
POST /api/bookings
        ↓
worker.tsx handler:
  1. Validate input (date, time, studio, group_type)
  2. getBlockedSlots(studioId, date) → Check for blocked slots
  3. checkConflict(studioId, date, startTime, endTime) → Check for overlaps
  4. isPeak = (time >= 18:00 OR day is weekend)
  5. getPricingForBooking(studioId, groupType, isPeak) → Get price/half-hour
  6. Calculate basePrice = pricePerHalfHour × halfHours
  7. If equipment selected: add equipment_price
  8. totalPrice = basePrice + equipment_price
  9. createBooking(db, {user_id, studio_id, date, start_time, end_time, ...})
  10. addAuditLog(db, 'booking', bookingId, 'create', {...})
  11. Return booking_ref (H3-YYYYMMDD-XXXX)
        ↓
Redirect to payment (Stripe Checkout)
        ↓
POST /api/stripe/checkout
        ↓
Create Stripe session
        ↓
Redirect to Stripe payment page
        ↓
User completes payment
        ↓
Stripe webhook → Mark payment as paid
        ↓
Redirect to PaymentSuccess.tsx


┌─────────────────────────────────────────────────────────────────────────────┐
│ ADMIN BOOKING CREATION (BookingNew.tsx)                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Admin selects user, studio, date/time, equipment
        ↓
POST /api/admin/bookings
        ↓
Same validation as public flow
        ↓
createBooking() + addAuditLog()
        ↓
Admin can immediately mark as paid (no Stripe)
        ↓
PUT /api/admin/bookings/:id
        ↓
updateBooking() + addAuditLog()
```

---

## Data Flow: User Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER BLOCKING                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

Admin clicks "Block" on Users.tsx
        ↓
POST /api/admin/users/:id/block
        ↓
blockUser(userId, true)
        ↓
updateUser(userId, {is_blocked: 1})
        ↓
addAuditLog('user', userId, 'block', {...})
        ↓
User cannot create new bookings


┌─────────────────────────────────────────────────────────────────────────────┐
│ USER MERGING (Duplicate consolidation)                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Admin selects primary user + duplicate users
        ↓
POST /api/admin/users/merge
        ↓
mergeUsers(primaryId, [dup1, dup2, ...])
        ↓
1. Fetch primary user
2. Fetch all duplicate users
3. UPDATE bookings SET user_id = primaryId WHERE user_id IN (duplicates)
4. UPDATE users SET total_bookings = sum, total_spent = sum WHERE id = primaryId
5. UPDATE users SET is_blocked = 1, email = "...merged..." WHERE id IN (duplicates)
6. addAuditLog('user', primaryId, 'merge', {mergedIds, mergedEmails})
        ↓
Duplicates marked as blocked with merged flag
Primary user has consolidated stats
```

---

## API Response Patterns

### Success Response
```json
{
  "success": true,
  "data": { /* entity data */ }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "data": [ /* array of entities */ ],
    "total": 150,
    "page": 1,
    "limit": 20
  }
}
```

---

## Key Constraints & Business Rules

### Booking Constraints
- ✓ No overlapping bookings in same studio
- ✓ Cannot book during blocked slots
- ✓ Cannot book outside opening hours
- ✓ Peak pricing: 18:00+ and weekends
- ✓ Minimum 30-minute slots
- ✓ Equipment max per session enforced

### User Constraints
- ✓ Email unique (if provided)
- ✓ Blocked users cannot create bookings
- ✓ Duplicate users can be merged
- ✓ Merge consolidates stats and bookings

### Payment Constraints
- ✓ Can refund up to full amount
- ✓ Partial refunds tracked
- ✓ Payment status: pending → paid → refunded

### Promo Code Constraints
- ✓ Code must be active
- ✓ Cannot use expired codes
- ✓ Usage count enforced
- ✓ Minimum total amount enforced

---

## Performance Optimizations

### Indexes (18 total)
- **Bookings:** date, user_id, studio_id, status, booking_ref
- **Payments:** booking_id
- **Blocked Slots:** date, studio_id
- **Audit Logs:** entity_type + entity_id, created_at
- **Sessions:** token, user_id
- **Users:** email
- **Opening Hours:** studio_id + day_of_week
- **Promo Codes:** code
- **Google Reviews:** rating, publish_time

### Pagination
- Bookings, Users, Payments, Audit Logs all paginated (default 20-50 per page)
- Prevents loading entire dataset into memory

### Caching Opportunities
- Pricing (rarely changes) → Cache in browser
- Opening Hours (rarely changes) → Cache in browser
- Equipment (rarely changes) → Cache in browser
- Settings (rarely changes) → Cache in browser
- Google Reviews → Cache with sync metadata

---

## Security Considerations

### Authentication
- Admin users stored in `admin_users` table
- Sessions tracked in `sessions` table with token + expiry
- Middleware checks token validity on protected routes

### Audit Trail
- All mutations logged to `audit_logs`
- Tracks: entity_type, entity_id, action, changes (JSON), performed_by, timestamp
- Enables compliance and debugging

### Data Validation
- All inputs validated in API handlers
- SQL injection prevented via parameterized queries (D1 API)
- Type safety via TypeScript

### Soft Deletes
- Bookings marked as 'cancelled' (not deleted)
- Users marked as 'is_blocked' (not deleted)
- Enables audit trail and recovery
