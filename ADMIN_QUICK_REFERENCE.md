# H3 Studios - Admin Panel Quick Reference

**Last Updated:** 2026-02-15  
**Scope:** Complete admin panel surface area, database schema, and API integration

---

## 📊 QUICK STATS

| Metric | Count |
|--------|-------|
| Admin Pages | 14 |
| Database Tables | 13 |
| Database Functions | 50+ |
| API Endpoints | 40+ |
| Indexes | 18 |
| Public Pages | 12 |

---

## 🎯 ADMIN PAGES AT A GLANCE

### Dashboard
- **File:** `Dashboard.tsx`
- **Purpose:** KPI overview
- **Key Metrics:** Today's bookings, week revenue, pending payments, occupancy %
- **Data Source:** `getDashboardStats()`

### Bookings Management
- **Files:** `Bookings.tsx`, `BookingDetail.tsx`, `BookingNew.tsx`
- **Features:**
  - List with filters (status, studio, date, search)
  - View/edit individual bookings
  - Create bookings manually
  - Cancel with reason
  - Mark as paid/refund
- **Key Functions:** `getBookings()`, `getBookingById()`, `createBooking()`, `updateBooking()`, `checkConflict()`

### User Management
- **Files:** `Users.tsx`, `UserDetail.tsx`
- **Features:**
  - List with search/filter
  - View user profile + booking history
  - Block/unblock users
  - Merge duplicate users
  - Edit user info
- **Key Functions:** `getUsers()`, `getUserById()`, `blockUser()`, `mergeUsers()`

### Payment Management
- **File:** `Payments.tsx`
- **Features:**
  - List all payments
  - Mark as paid
  - Process refunds (full/partial)
  - View associated booking
- **Key Functions:** `getPayments()`, `markPaymentPaid()`, `refundPayment()`

### Configuration
- **Files:** `Pricing.tsx`, `Studios.tsx`, `BlockedSlots.tsx`, `Settings.tsx`, `Calendar.tsx`
- **Features:**
  - Edit pricing per studio/group type/peak
  - Manage blocked time slots
  - View/edit app settings
  - Visual calendar view
- **Key Functions:** `getPricing()`, `getBlockedSlots()`, `getAllSettings()`, `getOpeningHours()`

### Audit & Security
- **Files:** `AuditLog.tsx`, `Login.tsx`
- **Features:**
  - View all admin actions
  - Filter by entity/action/date
  - Admin login/session management
- **Key Functions:** `getAuditLogs()`, `addAuditLog()`

---

## 🗄️ DATABASE TABLES SUMMARY

### Authentication (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `admin_users` | Admin accounts | id, email, password_hash, role (super-admin\|operator) |
| `sessions` | Auth sessions | id, user_id, token, expires_at |

### Business Core (4 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | Clients/musicians | id, email, name, phone, band_name, is_blocked, total_bookings, total_spent |
| `bookings` | Reservations | id, booking_ref, user_id, studio_id, date, start_time, end_time, status, total_price |
| `payments` | Payment tracking | id, booking_id, amount, status (pending\|paid\|refunded), refunded_amount |
| `blocked_slots` | Maintenance/events | id, studio_id, date, start_time, end_time, reason |

### Configuration (5 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `pricing` | Studio pricing | id, studio_id, group_type (solo\|duo\|group), is_peak, price_per_half_hour |
| `equipment` | Rental equipment | id, equipment_id, name, max_per_session, pricing_type (session\|hourly) |
| `opening_hours` | Studio hours | id, studio_id, day_of_week (0-6), open_time, close_time, is_closed |
| `promo_codes` | Discount codes | id, code, type (percentage\|fixed), value, expires_at, usage_count, max_usage |
| `settings` | App config | id, key, value |

### Audit & External (2 tables)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `audit_logs` | Admin action history | id, entity_type, entity_id, action, changes (JSON), performed_by, created_at |
| `google_reviews` | Google Places cache | id, google_review_id, author_name, rating (1-5), text, publish_time |

---

## 🔌 API ENDPOINTS QUICK MAP

### Public Booking APIs
```
POST   /api/bookings              Create booking (pricing + availability check)
GET    /api/availability          Check available slots
```

### Admin Booking APIs
```
GET    /api/admin/bookings        List bookings (paginated, filterable)
GET    /api/admin/bookings/:id    Get booking detail
POST   /api/admin/bookings        Create booking
PUT    /api/admin/bookings/:id    Update booking
DELETE /api/admin/bookings/:id    Cancel booking
```

### Admin User APIs
```
GET    /api/admin/users           List users (paginated, searchable)
GET    /api/admin/users/:id       Get user detail
POST   /api/admin/users           Create user
PUT    /api/admin/users/:id       Update user
POST   /api/admin/users/:id/block Block/unblock user
POST   /api/admin/users/merge     Merge duplicate users
```

### Admin Payment APIs
```
GET    /api/admin/payments        List payments (paginated)
PUT    /api/admin/payments/:id/mark-paid  Mark as paid
POST   /api/admin/payments/:id/refund     Refund payment
```

### Admin Configuration APIs
```
GET    /api/admin/pricing         List pricing
PUT    /api/admin/pricing/:id     Update pricing

GET    /api/admin/equipment       List equipment
PUT    /api/admin/equipment/:id   Update equipment

GET    /api/admin/opening-hours   List opening hours
PUT    /api/admin/opening-hours/:id Update hours

GET    /api/admin/blocked-slots   List blocked slots
POST   /api/admin/blocked-slots   Add blocked slot
DELETE /api/admin/blocked-slots/:id Remove blocked slot

GET    /api/admin/settings        List all settings
PUT    /api/admin/settings/:key   Update setting
```

### Admin Audit & Dashboard APIs
```
GET    /api/admin/audit-logs      List audit logs (paginated, filterable)
GET    /api/admin/dashboard       Get dashboard stats
```

---

## 📝 KEY DATABASE FUNCTIONS

### Bookings (9 functions)
```typescript
getBookings(db, filters?, page?, limit?)           // List with pagination
getBookingById(db, id)                             // Get single booking
getBookingByRef(db, ref)                           // Get by booking_ref
createBooking(db, data)                            // Create new booking
updateBooking(db, id, data)                        // Update booking
getBookingsByDate(db, date)                        // Get bookings for date
getBookingsByDateRange(db, start, end)             // Get bookings in range
getBookingsByUser(db, userId)                      // Get user's bookings
checkConflict(db, studioId, date, start, end)      // Check for overlaps
```

### Users (7 functions)
```typescript
getUsers(db, filters?, page?, limit?)              // List with pagination
getUserById(db, id)                                // Get single user
getUserByEmail(db, email)                          // Get by email
createUser(db, data)                               // Create new user
updateUser(db, id, data)                           // Update user
blockUser(db, userId, blocked)                     // Block/unblock
mergeUsers(db, primaryId, duplicateIds)            // Merge duplicates
```

### Payments (4 functions)
```typescript
getPayments(db, page?, limit?)                     // List with pagination
getPaymentByBookingId(db, bookingId)               // Get payment for booking
markPaymentPaid(db, paymentId)                     // Mark as paid
refundPayment(db, paymentId, amount)               // Process refund
```

### Configuration (11 functions)
```typescript
// Pricing
getPricing(db)                                     // List all pricing
updatePricing(db, id, pricePerHalfHour)            // Update price
getPricingForBooking(db, studioId, groupType, isPeak) // Get price for booking

// Equipment
getEquipment(db)                                   // List equipment
updateEquipment(db, id, data)                      // Update equipment

// Opening Hours
getOpeningHours(db)                                // List hours
updateOpeningHours(db, id, data)                   // Update hours

// Promo Codes
getPromoCodes(db)                                  // List codes
createPromoCode(db, data)                          // Create code
updatePromoCode(db, id, data)                      // Update code
validatePromoCode(db, code, total)                 // Validate code

// Settings
getSetting(db, key)                                // Get single setting
setSetting(db, key, value)                         // Set setting
getAllSettings(db)                                 // Get all settings
```

### Audit & Dashboard (3 functions)
```typescript
addAuditLog(db, entityType, entityId, action, changes, performedBy?)
getAuditLogs(db, filters?, page?, limit?)
getDashboardStats(db)
```

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Admin Login Flow
1. User enters email + password on `Login.tsx`
2. POST `/api/admin/login` validates credentials
3. Creates session with token + expiry
4. Token stored in localStorage
5. All admin API requests include token in header
6. Middleware validates token on each request

### Session Management
- **Token Storage:** localStorage
- **Expiry:** Configurable (typically 24 hours)
- **Validation:** Checked on every admin API call
- **Logout:** Deletes session from DB + clears localStorage

### Roles
- **super-admin:** Full access to all features
- **operator:** Limited access (typically bookings + users only)

---

## 📈 PRICING LOGIC

### Peak vs Off-Peak
- **Peak:** 18:00+ OR weekends (Sat/Sun)
- **Off-Peak:** All other times

### Price Calculation
```
1. Determine if peak: time >= 18:00 OR day is weekend
2. Get price_per_half_hour from pricing table
3. Calculate half-hours: (endTime - startTime) / 30 minutes
4. basePrice = price_per_half_hour × half-hours
5. If equipment selected: add equipment_price
6. totalPrice = basePrice + equipment_price
7. If promo code: apply discount
```

### Pricing Table Structure
```
studio_id | group_type | is_peak | price_per_half_hour
──────────┼────────────┼─────────┼────────────────────
la-scene  | solo       | 0       | 25 (example)
la-scene  | solo       | 1       | 35 (example)
la-scene  | duo        | 0       | 40 (example)
la-scene  | duo        | 1       | 55 (example)
...
```

---

## 🎯 COMMON ADMIN TASKS

### Create a Booking
1. Go to Bookings → New Booking
2. Select user (or create new)
3. Select studio
4. Select date + time
5. Select equipment (optional)
6. Select payment method
7. Click Create
8. Optionally mark as paid immediately

### Block a User
1. Go to Users
2. Find user
3. Click "Block"
4. Confirm
5. User cannot create new bookings

### Merge Duplicate Users
1. Go to Users
2. Select primary user
3. Click "Merge"
4. Select duplicate users
5. Confirm
6. Duplicates marked as blocked, stats consolidated

### Process Refund
1. Go to Payments
2. Find payment
3. Click "Refund"
4. Enter refund amount
5. Confirm
6. Payment status updated, audit logged

### Update Pricing
1. Go to Pricing
2. Find pricing row (studio + group_type + peak)
3. Edit price_per_half_hour
4. Save
5. Changes apply immediately to new bookings

### Block Time Slot
1. Go to Blocked Slots
2. Click "Add Slot"
3. Select studio (or leave blank for all)
4. Select date + time
5. Enter reason (maintenance, private event, etc.)
6. Save
7. Slot unavailable for bookings

---

## 🔍 FILTERING & SEARCH

### Bookings Filter
- **Status:** confirmed, cancelled, completed, no-show
- **Studio:** La Scene, Le Podium
- **Date Range:** From/To dates
- **Search:** booking_ref or user name

### Users Filter
- **Search:** name, email, or band_name
- **Status:** All, Blocked only

### Audit Logs Filter
- **Entity Type:** booking, user, payment, etc.
- **Action:** create, update, delete, merge, etc.
- **Date Range:** From/To dates

---

## 📊 DASHBOARD METRICS

| Metric | Calculation | Use Case |
|--------|-------------|----------|
| Today's Bookings | COUNT(bookings WHERE date = today AND status != 'cancelled') | Quick overview |
| Today's Revenue | SUM(total_price WHERE date = today AND status != 'cancelled') | Daily revenue |
| Week's Bookings | COUNT(bookings WHERE date >= week_start AND status != 'cancelled') | Weekly trend |
| Week's Revenue | SUM(total_price WHERE date >= week_start AND status != 'cancelled') | Weekly revenue |
| Month's Bookings | COUNT(bookings WHERE date >= month_start AND status != 'cancelled') | Monthly trend |
| Month's Revenue | SUM(total_price WHERE date >= month_start AND status != 'cancelled') | Monthly revenue |
| Pending Payments | COUNT(payments WHERE status = 'pending') | Follow-up needed |
| Pending Amount | SUM(amount WHERE status = 'pending') | Cash flow |
| Occupancy Today | (used_slots / total_slots) × 100 | Studio utilization |

---

## 🚀 PERFORMANCE NOTES

### Pagination
- **Default Limit:** 20 rows per page
- **Max Limit:** 100 rows per page
- **Applies To:** Bookings, Users, Payments, Audit Logs

### Indexes
- **18 total indexes** for common queries
- **Fastest Queries:** By date, user_id, studio_id, status, booking_ref
- **Slowest Queries:** Full table scans (avoid without filters)

### Caching Opportunities
- Pricing (rarely changes) → Cache 1 hour
- Equipment (rarely changes) → Cache 1 hour
- Opening Hours (rarely changes) → Cache 1 hour
- Settings (rarely changes) → Cache 1 hour
- Google Reviews → Cache with sync metadata

---

## 🔗 INTEGRATION POINTS

### Public Pages Using Admin Data
- **Reservation.tsx** → Uses `getPricingForBooking()`, `getBlockedSlots()`
- **Avis.tsx** → Uses `google_reviews` table

### Admin Pages Using Core Data
- **All admin pages** → Use functions from `src/lib/db.ts`
- **All mutations** → Logged to `audit_logs` table

### External Integrations
- **Stripe** → Payment processing (webhook updates payment status)
- **Google Places API** → Reviews sync (cached in `google_reviews` table)

---

## 📋 AUDIT LOGGING

### What Gets Logged
- ✓ All booking creates/updates/cancellations
- ✓ All user creates/updates/blocks/merges
- ✓ All payment marks/refunds
- ✓ All pricing/equipment/hours updates
- ✓ All blocked slot adds/removes
- ✓ All setting changes

### Audit Log Fields
```json
{
  "id": "uuid",
  "entity_type": "booking|user|payment|...",
  "entity_id": "uuid",
  "action": "create|update|delete|merge|...",
  "changes": { /* JSON object of what changed */ },
  "performed_by": "admin_user_id",
  "created_at": "2026-02-15 10:30:45"
}
```

### Querying Audit Logs
```
GET /api/admin/audit-logs?entity_type=booking&action=create&dateFrom=2026-02-01&dateTo=2026-02-15&page=1&limit=50
```

---

## ⚠️ IMPORTANT CONSTRAINTS

### Booking Constraints
- ✓ No overlapping bookings in same studio
- ✓ Cannot book during blocked slots
- ✓ Cannot book outside opening hours
- ✓ Minimum 30-minute slots
- ✓ Equipment max per session enforced

### User Constraints
- ✓ Email must be unique (if provided)
- ✓ Blocked users cannot create bookings
- ✓ Duplicate users can be merged

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

## 🛠️ TROUBLESHOOTING

### Booking Creation Fails
- Check: Studio exists
- Check: Date is in future
- Check: Time is within opening hours
- Check: No overlapping bookings
- Check: No blocked slots
- Check: User is not blocked

### User Merge Fails
- Check: Primary user exists
- Check: All duplicate users exist
- Check: Duplicates are not the same as primary

### Payment Refund Fails
- Check: Payment exists
- Check: Refund amount ≤ (payment amount - already refunded)
- Check: Payment status allows refund

### Promo Code Validation Fails
- Check: Code exists and is active
- Check: Code not expired
- Check: Usage count < max_usage
- Check: Total amount ≥ min_total

---

## 📞 SUPPORT CONTACTS

For issues with:
- **Database:** Check migrations in `/migrations/`
- **API:** Check `src/worker.tsx`
- **Admin Pages:** Check `src/app/pages/admin/`
- **Types:** Check `src/lib/db-types.ts`
- **Functions:** Check `src/lib/db.ts`

---

## 📚 RELATED DOCUMENTATION

- `ADMIN_SURFACE_AREA.md` - Detailed schema + functions
- `ADMIN_ARCHITECTURE.md` - System diagrams + data flows
- `AGENTS.md` - Project guidelines + commands
- `README.md` - Project overview
