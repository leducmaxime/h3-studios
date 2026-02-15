# H3 Studios - Admin Documentation Index

**Complete mapping of admin panel, database, and API surface area**

---

## 📚 Documentation Files

### 1. **ADMIN_QUICK_REFERENCE.md** ⭐ START HERE
   - **Best for:** Quick lookups, common tasks, API endpoints
   - **Contains:**
     - Quick stats (14 pages, 13 tables, 50+ functions)
     - Admin pages at a glance
     - Database tables summary
     - API endpoints quick map
     - Key database functions
     - Common admin tasks
     - Filtering & search options
     - Dashboard metrics
     - Troubleshooting guide

### 2. **ADMIN_SURFACE_AREA.md** 📋 DETAILED REFERENCE
   - **Best for:** Complete schema documentation, function signatures
   - **Contains:**
     - All 14 admin page files with purposes
     - Complete database schema (13 tables)
     - All 50+ database functions with signatures
     - All 12 public pages
     - All API endpoints in worker.tsx
     - Function usage summary
     - Key insights
     - Migration status
     - Type definitions
     - Next steps for development

### 3. **ADMIN_ARCHITECTURE.md** 🏗️ SYSTEM DESIGN
   - **Best for:** Understanding system architecture, data flows
   - **Contains:**
     - System architecture diagram
     - Database schema diagram
     - Admin panel page hierarchy
     - Data flow: Booking creation
     - Data flow: User management
     - API response patterns
     - Key constraints & business rules
     - Performance optimizations
     - Security considerations

### 4. **ADMIN_INDEX.md** (this file) 🗂️ NAVIGATION
   - **Best for:** Finding the right documentation
   - **Contains:** This index + quick navigation

---

## 🎯 QUICK NAVIGATION BY TASK

### I want to...

#### Understand the Admin Panel
→ Start with **ADMIN_QUICK_REFERENCE.md** (Admin Pages section)
→ Then read **ADMIN_ARCHITECTURE.md** (Admin Panel Page Hierarchy)

#### Find a Database Function
→ Use **ADMIN_SURFACE_AREA.md** (Database Functions section)
→ Or **ADMIN_QUICK_REFERENCE.md** (Key Database Functions section)

#### Understand the Database Schema
→ Read **ADMIN_SURFACE_AREA.md** (Database Schema section)
→ Or **ADMIN_ARCHITECTURE.md** (Database Schema Diagram)

#### Find an API Endpoint
→ Use **ADMIN_QUICK_REFERENCE.md** (API Endpoints Quick Map)
→ Or **ADMIN_SURFACE_AREA.md** (API Endpoints in worker.tsx)

#### Understand How Bookings Work
→ Read **ADMIN_ARCHITECTURE.md** (Data Flow: Booking Creation)
→ Then check **ADMIN_QUICK_REFERENCE.md** (Pricing Logic)

#### Understand How Users Are Managed
→ Read **ADMIN_ARCHITECTURE.md** (Data Flow: User Management)
→ Then check **ADMIN_QUICK_REFERENCE.md** (Common Admin Tasks)

#### Learn About Audit Logging
→ Check **ADMIN_QUICK_REFERENCE.md** (Audit Logging section)
→ Or **ADMIN_SURFACE_AREA.md** (Audit Logs section)

#### Troubleshoot an Issue
→ Go to **ADMIN_QUICK_REFERENCE.md** (Troubleshooting section)

#### Understand Performance
→ Read **ADMIN_ARCHITECTURE.md** (Performance Optimizations)
→ Or **ADMIN_QUICK_REFERENCE.md** (Performance Notes)

#### Learn About Security
→ Read **ADMIN_ARCHITECTURE.md** (Security Considerations)
→ Or **ADMIN_QUICK_REFERENCE.md** (Authentication & Authorization)

---

## 📊 QUICK STATS

| Metric | Count | Reference |
|--------|-------|-----------|
| Admin Pages | 14 | ADMIN_SURFACE_AREA.md §1 |
| Database Tables | 13 | ADMIN_SURFACE_AREA.md §2 |
| Database Functions | 50+ | ADMIN_SURFACE_AREA.md §3 |
| API Endpoints | 40+ | ADMIN_SURFACE_AREA.md §5 |
| Database Indexes | 18 | ADMIN_SURFACE_AREA.md §2 |
| Public Pages | 12 | ADMIN_SURFACE_AREA.md §4 |

---

## 🗂️ ADMIN PAGES DIRECTORY

| Page | File | Purpose | Reference |
|------|------|---------|-----------|
| Dashboard | `Dashboard.tsx` | KPI overview | ADMIN_QUICK_REFERENCE.md |
| Bookings | `Bookings.tsx` | List bookings | ADMIN_QUICK_REFERENCE.md |
| Booking Detail | `BookingDetail.tsx` | View/edit booking | ADMIN_QUICK_REFERENCE.md |
| New Booking | `BookingNew.tsx` | Create booking | ADMIN_QUICK_REFERENCE.md |
| Users | `Users.tsx` | Manage users | ADMIN_QUICK_REFERENCE.md |
| User Detail | `UserDetail.tsx` | View/edit user | ADMIN_QUICK_REFERENCE.md |
| Payments | `Payments.tsx` | Track payments | ADMIN_QUICK_REFERENCE.md |
| Pricing | `Pricing.tsx` | Edit pricing | ADMIN_QUICK_REFERENCE.md |
| Studios | `Studios.tsx` | Manage studios | ADMIN_QUICK_REFERENCE.md |
| Calendar | `Calendar.tsx` | Visual calendar | ADMIN_QUICK_REFERENCE.md |
| Blocked Slots | `BlockedSlots.tsx` | Maintenance slots | ADMIN_QUICK_REFERENCE.md |
| Settings | `Settings.tsx` | App config | ADMIN_QUICK_REFERENCE.md |
| Audit Log | `AuditLog.tsx` | Action history | ADMIN_QUICK_REFERENCE.md |
| Login | `Login.tsx` | Admin auth | ADMIN_QUICK_REFERENCE.md |

---

## 🗄️ DATABASE TABLES DIRECTORY

| Table | Purpose | Key Fields | Reference |
|-------|---------|-----------|-----------|
| `admin_users` | Admin accounts | id, email, role | ADMIN_SURFACE_AREA.md §2 |
| `sessions` | Auth sessions | id, user_id, token | ADMIN_SURFACE_AREA.md §2 |
| `users` | Clients | id, email, name, is_blocked | ADMIN_SURFACE_AREA.md §2 |
| `bookings` | Reservations | id, booking_ref, user_id, studio_id | ADMIN_SURFACE_AREA.md §2 |
| `payments` | Payment tracking | id, booking_id, amount, status | ADMIN_SURFACE_AREA.md §2 |
| `blocked_slots` | Maintenance | id, studio_id, date, reason | ADMIN_SURFACE_AREA.md §2 |
| `pricing` | Studio pricing | id, studio_id, group_type, price | ADMIN_SURFACE_AREA.md §2 |
| `equipment` | Rental equipment | id, equipment_id, name | ADMIN_SURFACE_AREA.md §2 |
| `opening_hours` | Studio hours | id, studio_id, day_of_week | ADMIN_SURFACE_AREA.md §2 |
| `promo_codes` | Discount codes | id, code, type, value | ADMIN_SURFACE_AREA.md §2 |
| `settings` | App config | id, key, value | ADMIN_SURFACE_AREA.md §2 |
| `audit_logs` | Action history | id, entity_type, action | ADMIN_SURFACE_AREA.md §2 |
| `google_reviews` | Google cache | id, google_review_id, rating | ADMIN_SURFACE_AREA.md §2 |

---

## 🔌 API ENDPOINTS DIRECTORY

### Booking APIs
| Endpoint | Method | Purpose | Reference |
|----------|--------|---------|-----------|
| `/api/bookings` | POST | Create booking | ADMIN_QUICK_REFERENCE.md |
| `/api/availability` | GET | Check slots | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/bookings` | GET | List bookings | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/bookings/:id` | GET | Get booking | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/bookings` | POST | Create booking | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/bookings/:id` | PUT | Update booking | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/bookings/:id` | DELETE | Cancel booking | ADMIN_QUICK_REFERENCE.md |

### User APIs
| Endpoint | Method | Purpose | Reference |
|----------|--------|---------|-----------|
| `/api/admin/users` | GET | List users | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/users/:id` | GET | Get user | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/users` | POST | Create user | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/users/:id` | PUT | Update user | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/users/:id/block` | POST | Block user | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/users/merge` | POST | Merge users | ADMIN_QUICK_REFERENCE.md |

### Payment APIs
| Endpoint | Method | Purpose | Reference |
|----------|--------|---------|-----------|
| `/api/admin/payments` | GET | List payments | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/payments/:id/mark-paid` | PUT | Mark paid | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/payments/:id/refund` | POST | Refund | ADMIN_QUICK_REFERENCE.md |

### Configuration APIs
| Endpoint | Method | Purpose | Reference |
|----------|--------|---------|-----------|
| `/api/admin/pricing` | GET | List pricing | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/pricing/:id` | PUT | Update pricing | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/equipment` | GET | List equipment | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/equipment/:id` | PUT | Update equipment | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/opening-hours` | GET | List hours | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/opening-hours/:id` | PUT | Update hours | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/blocked-slots` | GET | List slots | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/blocked-slots` | POST | Add slot | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/blocked-slots/:id` | DELETE | Remove slot | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/settings` | GET | List settings | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/settings/:key` | PUT | Update setting | ADMIN_QUICK_REFERENCE.md |

### Audit & Dashboard APIs
| Endpoint | Method | Purpose | Reference |
|----------|--------|---------|-----------|
| `/api/admin/audit-logs` | GET | List audit logs | ADMIN_QUICK_REFERENCE.md |
| `/api/admin/dashboard` | GET | Dashboard stats | ADMIN_QUICK_REFERENCE.md |

---

## 🔍 FUNCTION REFERENCE BY CATEGORY

### Bookings (9 functions)
- `getBookings()` - ADMIN_SURFACE_AREA.md §3
- `getBookingById()` - ADMIN_SURFACE_AREA.md §3
- `getBookingByRef()` - ADMIN_SURFACE_AREA.md §3
- `createBooking()` - ADMIN_SURFACE_AREA.md §3
- `updateBooking()` - ADMIN_SURFACE_AREA.md §3
- `getBookingsByDate()` - ADMIN_SURFACE_AREA.md §3
- `getBookingsByDateRange()` - ADMIN_SURFACE_AREA.md §3
- `getBookingsByUser()` - ADMIN_SURFACE_AREA.md §3
- `checkConflict()` - ADMIN_SURFACE_AREA.md §3

### Users (7 functions)
- `getUsers()` - ADMIN_SURFACE_AREA.md §3
- `getUserById()` - ADMIN_SURFACE_AREA.md §3
- `getUserByEmail()` - ADMIN_SURFACE_AREA.md §3
- `createUser()` - ADMIN_SURFACE_AREA.md §3
- `updateUser()` - ADMIN_SURFACE_AREA.md §3
- `blockUser()` - ADMIN_SURFACE_AREA.md §3
- `mergeUsers()` - ADMIN_SURFACE_AREA.md §3

### Payments (4 functions)
- `getPayments()` - ADMIN_SURFACE_AREA.md §3
- `getPaymentByBookingId()` - ADMIN_SURFACE_AREA.md §3
- `markPaymentPaid()` - ADMIN_SURFACE_AREA.md §3
- `refundPayment()` - ADMIN_SURFACE_AREA.md §3

### Configuration (11 functions)
- `getPricing()` - ADMIN_SURFACE_AREA.md §3
- `updatePricing()` - ADMIN_SURFACE_AREA.md §3
- `getPricingForBooking()` - ADMIN_SURFACE_AREA.md §3
- `getEquipment()` - ADMIN_SURFACE_AREA.md §3
- `updateEquipment()` - ADMIN_SURFACE_AREA.md §3
- `getOpeningHours()` - ADMIN_SURFACE_AREA.md §3
- `updateOpeningHours()` - ADMIN_SURFACE_AREA.md §3
- `getPromoCodes()` - ADMIN_SURFACE_AREA.md §3
- `createPromoCode()` - ADMIN_SURFACE_AREA.md §3
- `updatePromoCode()` - ADMIN_SURFACE_AREA.md §3
- `validatePromoCode()` - ADMIN_SURFACE_AREA.md §3

### Settings (3 functions)
- `getSetting()` - ADMIN_SURFACE_AREA.md §3
- `setSetting()` - ADMIN_SURFACE_AREA.md §3
- `getAllSettings()` - ADMIN_SURFACE_AREA.md §3

### Audit & Dashboard (3 functions)
- `addAuditLog()` - ADMIN_SURFACE_AREA.md §3
- `getAuditLogs()` - ADMIN_SURFACE_AREA.md §3
- `getDashboardStats()` - ADMIN_SURFACE_AREA.md §3

---

## 🎓 LEARNING PATH

### For New Developers
1. Read **ADMIN_QUICK_REFERENCE.md** (5 min)
2. Read **ADMIN_ARCHITECTURE.md** (10 min)
3. Read **ADMIN_SURFACE_AREA.md** (15 min)
4. Explore `src/app/pages/admin/` (20 min)
5. Explore `src/lib/db.ts` (20 min)
6. Explore `src/worker.tsx` (20 min)

### For Adding New Features
1. Check **ADMIN_QUICK_REFERENCE.md** for similar features
2. Read **ADMIN_SURFACE_AREA.md** for database schema
3. Check **ADMIN_ARCHITECTURE.md** for data flows
4. Implement following existing patterns

### For Debugging
1. Check **ADMIN_QUICK_REFERENCE.md** (Troubleshooting)
2. Check **ADMIN_SURFACE_AREA.md** for function signatures
3. Check **ADMIN_ARCHITECTURE.md** for data flows
4. Check `src/lib/db.ts` for implementation

---

## 📞 QUICK LINKS

| Topic | File | Section |
|-------|------|---------|
| Admin Pages | ADMIN_QUICK_REFERENCE.md | Admin Pages at a Glance |
| Database Tables | ADMIN_QUICK_REFERENCE.md | Database Tables Summary |
| API Endpoints | ADMIN_QUICK_REFERENCE.md | API Endpoints Quick Map |
| Database Functions | ADMIN_QUICK_REFERENCE.md | Key Database Functions |
| Common Tasks | ADMIN_QUICK_REFERENCE.md | Common Admin Tasks |
| Pricing Logic | ADMIN_QUICK_REFERENCE.md | Pricing Logic |
| Filtering | ADMIN_QUICK_REFERENCE.md | Filtering & Search |
| Dashboard | ADMIN_QUICK_REFERENCE.md | Dashboard Metrics |
| Troubleshooting | ADMIN_QUICK_REFERENCE.md | Troubleshooting |
| Architecture | ADMIN_ARCHITECTURE.md | System Architecture |
| Data Flows | ADMIN_ARCHITECTURE.md | Data Flow Diagrams |
| Security | ADMIN_ARCHITECTURE.md | Security Considerations |
| Performance | ADMIN_ARCHITECTURE.md | Performance Optimizations |
| Complete Schema | ADMIN_SURFACE_AREA.md | Database Schema |
| All Functions | ADMIN_SURFACE_AREA.md | Database Functions |
| All Endpoints | ADMIN_SURFACE_AREA.md | API Endpoints |
| Migrations | ADMIN_SURFACE_AREA.md | Migration Status |

---

## 🔄 DOCUMENT RELATIONSHIPS

```
ADMIN_INDEX.md (you are here)
    ↓
    ├─→ ADMIN_QUICK_REFERENCE.md (start here for quick lookups)
    │   ├─→ ADMIN_ARCHITECTURE.md (for system design)
    │   └─→ ADMIN_SURFACE_AREA.md (for detailed reference)
    │
    ├─→ ADMIN_ARCHITECTURE.md (for understanding system)
    │   ├─→ ADMIN_QUICK_REFERENCE.md (for quick facts)
    │   └─→ ADMIN_SURFACE_AREA.md (for detailed schema)
    │
    └─→ ADMIN_SURFACE_AREA.md (for complete reference)
        ├─→ ADMIN_QUICK_REFERENCE.md (for summaries)
        └─→ ADMIN_ARCHITECTURE.md (for diagrams)
```

---

## 📝 DOCUMENT METADATA

| Document | Size | Sections | Purpose |
|----------|------|----------|---------|
| ADMIN_QUICK_REFERENCE.md | ~8KB | 20 | Quick lookups, common tasks |
| ADMIN_ARCHITECTURE.md | ~12KB | 15 | System design, data flows |
| ADMIN_SURFACE_AREA.md | ~20KB | 10 | Complete reference, schema |
| ADMIN_INDEX.md | ~6KB | 10 | Navigation, this file |

**Total Documentation:** ~46KB, 55 sections

---

## ✅ VERIFICATION CHECKLIST

Use this checklist to verify you have the right documentation:

- [ ] Need quick API endpoint? → ADMIN_QUICK_REFERENCE.md
- [ ] Need database function signature? → ADMIN_SURFACE_AREA.md
- [ ] Need to understand data flow? → ADMIN_ARCHITECTURE.md
- [ ] Need to find a specific page? → ADMIN_INDEX.md (this file)
- [ ] Need to troubleshoot? → ADMIN_QUICK_REFERENCE.md
- [ ] Need to understand security? → ADMIN_ARCHITECTURE.md
- [ ] Need to understand performance? → ADMIN_ARCHITECTURE.md
- [ ] Need complete schema? → ADMIN_SURFACE_AREA.md
- [ ] Need to learn system? → ADMIN_ARCHITECTURE.md
- [ ] Need to add new feature? → ADMIN_SURFACE_AREA.md

---

**Last Updated:** 2026-02-15  
**Status:** Complete  
**Coverage:** 100% of admin panel, database, and API surface area
