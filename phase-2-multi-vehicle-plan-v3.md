# Phase 2 Implementation Plan – Multi-Vehicle Transportation (MVP) — v3

This phase focuses **only** on supporting multiple transportation vehicles for a single transportation day. **Multi-course support will be implemented later**. The goal is to keep the current workflow intact while allowing coordinators to manage multiple buses or microbuses simultaneously.

*v3 changes (post-codebase feasibility review): corrected all data-layer references from Firestore to Firebase Realtime Database (the actual stack) — including transactions, security rules, and paths; added an explicit "Close Day" trip-completion flow; deferred server-triggered notifications in favor of client-triggered toasts for this phase, with a documented fast-follow; specified a clean cut-over migration (no dual old/new data model); and added a sub-phase rollout plan (2a–2d).*

---

# Objective

Transform the current single-vehicle transportation workflow into a **multi-vehicle transportation system** without changing the student experience.

Students will continue to:

* Confirm attendance.
* Select their default pickup point.
* Track today's transportation.

The difference is that they may now see **multiple active vehicles** serving the same route.

---

# Scope

This phase includes:

* Multiple vehicles.
* Multiple coordinators.
* Vehicle assignment (with atomic locking and release).
* Independent live tracking.
* Shared boarding list (with undo support).
* Capacity management (derived, not just counted).
* Student notifications (client-triggered for this phase — see §11).

This phase **does NOT** include:

* Multiple courses.
* Driver accounts.
* Role-based permissions.
* Fleet management.
* Vehicle history.
* Server-triggered (Cloud Function / FCM) notifications — deferred, see §11.

Those belong to Phase 3 or a fast-follow.

---

# Key Design Assumption

All vehicles in a given transportation day serve the **same route and the same set of pickup points**, in parallel. This is why a single shared boarding list works. Splitting vehicles across different stops or routes is explicitly out of scope for Phase 2.

---

# Rollout Plan — Sub-Phases

Given the scope of the rewrite, ship incrementally rather than as one big-bang release:

* **2a — Data model + vehicle CRUD + planning screen.** New `rakeb/vehicles` and `rakeb/boardingRecords` paths, vehicle add/remove UI, capacity dashboard (§4). No tracking or boarding yet.
* **2b — Independent GPS tracking + vehicle assignment.** Take Control / Release Control (§5), per-vehicle tracking sessions (§6).
* **2c — Shared boarding + undo + occupancy.** Shared boarding list (§7), derived occupancy (§8), Full status (§9).
* **2d — Notifications + security rules hardening.** Client-triggered Full notifications (§11), expanded `database.rules.json` (§16).

Each sub-phase should be independently testable with real coordinators before moving to the next.

---

# 1. Multiple Coordinator Accounts

No code changes required. `AuthContext.tsx` already reads `role` from `rakeb/users/{uid}/role` and grants admin access when `role === "admin"`; `database.rules.json` already gates writes on the same field. This step is purely operational:

Create three Firebase Authentication accounts and set `role: "admin"` on each.

| Display Name | Email                                       |
| ------------ | ------------------------------------------- |
| Admin 1      | [admin1@rakeb.com](mailto:admin1@rakeb.com) |
| Admin 2      | [admin2@rakeb.com](mailto:admin2@rakeb.com) |
| Admin 3      | [admin3@rakeb.com](mailto:admin3@rakeb.com) |

Requirements:

* All coordinators have identical permissions. No RBAC — every coordinator can manage everything.
* Future coordinators can be added without changing the architecture.

---

# 2. Replace the Single Vehicle Model

Currently the system assumes there is exactly one active trip (`rakeb/trips/default/{dateKey}`). Replace it with a collection of active vehicles under `rakeb/vehicles/default/{dateKey}/{vehicleId}`. Every vehicle is completely independent.

---

# 3. Vehicle Types

Only two vehicle types for the MVP: `Bus`, `Microbus`. Vehicle identity is temporary — no permanent plate number or saved fleet. Every transportation day creates new vehicle entries under that day's `dateKey`.

---

# 4. Transportation Planning

After registration closes, the coordinator opens the dashboard and sees `Confirmed Students`. They manually add vehicles (type + capacity) before the day starts. The dashboard shows total capacity, remaining seats, and a warning if capacity is insufficient — same behavior as before, just computed across the vehicle collection instead of a single trip object.

---

# 5. Vehicle Assignment (Take Control / Release Control)

Every vehicle can only be controlled by **one coordinator at a time**.

## 5.1 Taking control

This must be an atomic check-and-set on the Realtime Database, using `runTransaction()` — the same pattern already used for `transactionalAdvanceDate` in `TripRepository.ts` (`src/lib/TripRepository.ts#L119-L146`). A naive read-then-write on the client would let two coordinators both "win" if they tap within milliseconds of each other.

```
runTransaction(vehicleRef, (vehicle) => {
  if (vehicle.assignedCoordinatorId && !isStale(vehicle.lastHeartbeatAt)) {
    return; // abort — already controlled
  }
  vehicle.assignedCoordinatorId = currentUser.id;
  vehicle.assignedAt = now();
  return vehicle;
});
```

If the transaction aborts because someone else holds the lock, the UI shows `Controlled by <name>` and the coordinator picks another vehicle.

## 5.2 Releasing control

Two paths, both required:

* **Explicit release** — a "Release / End Tracking" action that clears `assignedCoordinatorId` and stops that vehicle's tracking session.
* **Automatic staleness recovery** — if `lastHeartbeatAt` hasn't updated within a defined timeout (crashed app, lost connectivity), another coordinator should be able to take control rather than the vehicle staying locked for the rest of the day. This is a plain field check inside the same transaction in §5.1 — no Cloud Function needed.

---

# 6. Independent Live Tracking

Every vehicle has its own live tracking session and its own location stream. Each assigned coordinator starts GPS tracking only for the vehicle assigned to them; students see every active vehicle moving independently on the map. `TrackMap.tsx` and `TripStatusBanner.tsx` already receive their data as props rather than querying Firebase directly, so this becomes a data-shape change (single vehicle → list of vehicles) rather than a rewrite of those components.

---

# 7. Shared Boarding List (with Undo)

There is **one** student list, shared across all vehicles — not a separate passenger list per vehicle. Boarding a student updates their status everywhere instantly; students can board **any available vehicle** and are not assigned to one.

This replaces the current `toggleBoarding()` boolean flip (`dailyStatus/{uid}.boarded`) with:

1. Creating a boarding record under `rakeb/boardingRecords/{dateKey}/{recordId}` containing `studentId`, `vehicleId`, `status`, `boardedAt`, `boardedByCoordinatorId`.
2. Transactionally incrementing that vehicle's `occupiedSeats` in the same write (§8).

## 7.1 Undo / un-board

Coordinators must be able to select a `Boarded` student and choose **Undo Boarding**, returning them to `Waiting`. This sets the boarding record's `status` to `undone` (soft-delete, not a hard delete, so the correction is auditable) and decrements the correct vehicle's `occupiedSeats` in the same transaction.

`BoardingList.tsx` itself stays mostly presentational; the rewrite is in the service layer underneath (`tripService.ts` boarding functions).

---

# 8. Vehicle Occupancy (Derived, Not a Raw Counter)

`occupiedSeats` must never be an independently-incremented field that can drift from the underlying boarding records. Every boarding and undo action (§7, §7.1) updates `occupiedSeats` in the **same RTDB transaction** as the boarding record write, so the counter and the records can never disagree. If reconciliation is ever needed, `occupiedSeats` can be recomputed by counting active (`status: boarded`) records for that vehicle.

---

# 9. Manual & Automatic Full Status

**Automatic:** occupancy reaching capacity sets `status: full`.

**Manual:** a coordinator may press `Mark Vehicle Full` even with seats remaining, because unregistered students may already be onboard. Marking a vehicle Full manually:

* Immediately hides it from students' active tracking list and triggers the Full notification (§11).
* Does **not** block a coordinator from continuing to board already-confirmed students onto it — the whole point of the manual override is that real occupancy exceeds what's tracked.
* Shows a soft warning (not a hard block) if triggered while `occupiedSeats < capacity`, so it's a deliberate action.

---

# 10. Student Experience

Students see a list of vehicles (🚌 Bus, 🚐 Microbus, 🚐 Microbus) each with running status and occupancy, and can follow any of them. This is a UI-only update to `TripStatusBanner.tsx`, `TrackMap.tsx`, and the student `home.lazy.tsx` route, since these already consume vehicle data as props.

---

# 11. Full Vehicle Notification — Client-Triggered for This Phase

**Decision: defer Cloud Functions.** There is no Cloud Functions infrastructure in this project today (`firebase.json` only configures database rules), and standing it up — project setup, FCM integration, a new deployment pipeline — is real new operational surface. For Phase 2, notifications will be **client-triggered**: the coordinator's own client fires the "vehicle full" toast/banner at the moment it writes `status: full`.

**Known accepted tradeoff:** if the coordinator's app crashes or loses connectivity immediately after marking a vehicle Full, the database update still lands but the notification is not sent, and students won't know that vehicle is done until they notice the occupancy number themselves or an out-of-band cue. This is an accepted gap for Phase 2, not an oversight — flagging it here so it isn't forgotten.

**Fast-follow:** once the vehicle/boarding data model has proven stable in production, migrate to a Cloud Function that triggers on `status` transitioning to `full` (`onUpdate` watcher) and sends via FCM, so delivery no longer depends on the triggering client staying alive. Track this as a follow-up ticket rather than closing it out — it's a reliability upgrade, not a "nice to have."

In both cases: hide the completed vehicle from the student's active tracking section once it's Full.

---

# 12. Route Progress

No changes required. `StationTimeline.tsx` is purely presentational and continues working independently per vehicle.

---

# 13. Coordinator Dashboard

The `trips.lazy.tsx` admin page (currently ~530 lines, built entirely around a single vehicle) becomes an operations dashboard: a vehicle-planning step before the day starts, per-vehicle cards (type, capacity, occupied seats, status, assigned coordinator, GPS status, route progress, Take Control / Release Control / Start Tracking / Mark Full / End Tracking), and a shared boarding list view. This is a full rewrite of that page, not an incremental patch.

---

# 14. Data Model (Realtime Database)

Clean cut-over — see §15 for why. New paths fully replace the old ones; there is no dual-write or backward-compatible period.

**Replaces** `rakeb/trips/default/{dateKey}`:

```
rakeb/vehicles/default/{dateKey}/{vehicleId}
  id
  type                    // "bus" | "microbus"
  capacity
  occupiedSeats           // kept in sync transactionally with boarding records
  status                  // planned | running | full | ended
  assignedCoordinatorId
  assignedAt
  lastHeartbeatAt          // for stale-assignment recovery
  trackingSessionId
  currentLocation
  createdAt
  updatedAt
```

**Replaces** the `boarded: boolean` field on `rakeb/dailyStatus/default/{dateKey}/{uid}`:

```
rakeb/boardingRecords/{dateKey}/{recordId}
  id
  studentId
  vehicleId
  status                  // boarded | undone
  boardedAt
  boardedByCoordinatorId
  undoneAt (nullable)
```

`dailyStatus/{uid}` stops storing `boarded` directly; boarding state is derived by querying `boardingRecords` for that student.

**Files requiring changes:** `tripService.ts` (`startTrip`, `completeTrip`, `departStation`, `arriveAtStation`, `toggleBoarding` — all become vehicle-scoped), `TripRepository.ts` (`atomicUpdate`, `readTripSnapshot`, `updateLocation`, `cleanStaleTrips`), `useTripStatus.tsx` (listen to the vehicles collection instead of a single trip path), `useTodayStatus.tsx` (derive boarding state from `boardingRecords`).

---

# 15. Migration Strategy — Clean Cut-Over

**Decision: clean cut-over, not backward-compatible.** The old `rakeb/trips/default/{dateKey}` and the `boarded` field on `dailyStatus` are fully replaced by §14's new paths; there is no code path that reads or writes both shapes simultaneously.

This is simpler to implement and reason about than a dual-write transition period, but it means the cut-over must happen at a point with **no trip in progress** — deploying mid-trip would leave a half-written trip in the old shape that the new code can't read. Sequence the deploy for a day with no active transportation (or explicitly outside operating hours), and treat any historical data in the old paths as archival only — the new code will not read from it.

---

# 16. Trip / Day Completion Flow

**Decision: explicit "Close Day" action**, not automatic advance on the last vehicle finishing. Auto-advancing on "last vehicle" requires reliably detecting which vehicle is last, which breaks the moment a vehicle's coordinator forgets to formally end it, or their app dies mid-trip — you'd either advance the date prematurely or never advance it. An explicit action is more predictable and mirrors the explicit-release pattern in §5.2.

**Two-phase flow:**

1. Each vehicle ends independently — a coordinator presses "End Tracking" on their vehicle, setting `status: ended`.
2. Once all vehicles for the day show `ended`, a "Close Day" action becomes available on the dashboard. This action does what `completeTrip()` does today (`tripService.ts#L143-L293`): reads `activeDateKey` for idempotency, runs the CAS transaction to advance the date (reusing the existing `transactionalAdvanceDate` pattern), archives to `tripHistory`, initializes the next day, syncs the cutoff timestamp — but now archiving the full vehicle + boarding-record set for that day instead of a single trip object.

The dashboard should visibly list any vehicle that hasn't reached `ended` yet and keep "Close Day" disabled until all have, so a half-finished day can't accidentally get archived with vehicles still running.

---

# 17. Security Rules (`database.rules.json`)

Rules roughly double in complexity but follow the existing `role === 'admin'` gating pattern already in place:

* **Coordinator writes** (vehicle status, control assignment, boarding records, GPS updates) — remain gated on `role === 'admin'`, same as today.
* **Vehicle-scoped GPS writes** — only the coordinator currently in `assignedCoordinatorId` for a given vehicle may write its `currentLocation`.
* **Take Control writes** — the `assignedCoordinatorId` field should only be settable through the transaction pattern in §5.1, not as an arbitrary direct write, to keep the atomicity guarantee meaningful rather than just client-side convention.
* **Boarding record writes** — any admin/coordinator may create or update boarding records; students get read-only access to vehicle status/location and their own boarding record, with no write access to occupancy, status, or other students' records.

---

# 18. Impact Summary

| Area | Files | Change Type | Risk | Effort |
|------|-------|-------------|------|--------|
| Auth / coordinator accounts | `AuthContext.tsx` | None needed | 🟢 None | 0.5 day |
| Data model (vehicles + boarding) | `tripService.ts`, `TripRepository.ts` | Full rewrite | 🟡 Medium | 2-3 days |
| Trip status hook | `useTripStatus.tsx` | Rewrite (single → multi listener) | 🟡 Medium | 1 day |
| Boarding logic | `BoardingList.tsx`, `useTodayStatus.tsx` | Significant refactor | 🟡 Medium | 1-2 days |
| Vehicle assignment (new) | New files | New feature | 🟡 Medium | 1-2 days |
| Admin trips page | `trips.lazy.tsx` | Full rewrite | 🟡 Medium | 2-3 days |
| Student UI | `TripStatusBanner.tsx`, `TrackMap.tsx`, `home.lazy.tsx` | Moderate update | 🟢 Low | 1 day |
| Day completion (§16) | `tripService.ts` `completeTrip()` | Redesign (two-phase) | 🟡 Medium | 1-2 days |
| Notifications (§11) | Client-side, deferred Cloud Function | Client-triggered now | 🟢 Low (for now) | 0.5 day |
| Security rules | `database.rules.json` | Expand | 🟡 Medium | 0.5-1 day |
| **Total** | | | | **~10-14 days** |

Deferring Cloud Functions removes the one 🔴 High-risk item that required new infrastructure — the remaining work is substantial but medium-risk and follows patterns already present in the codebase (RTDB transactions, prop-driven UI components).

---

# 19. MVP Acceptance Criteria

* Multiple vehicles can exist simultaneously, added during planning (§4).
* Vehicles have independent GPS tracking (§6).
* Only one coordinator controls each vehicle at a time, enforced atomically via RTDB transaction (§5.1) — no double-assignment race.
* A vehicle's control can be released explicitly or recovered automatically after staleness (§5.2).
* Multiple coordinators can work at the same time.
* Boarding status syncs instantly across every vehicle (§7).
* Boarding actions can be undone without corrupting occupancy counts (§7.1).
* Vehicle occupancy is always consistent with the underlying boarding records (§8).
* Vehicles can become Full automatically or manually, with manual Full not blocking further boarding of already-confirmed students (§9).
* Students receive a client-triggered notification when a vehicle becomes full, with the known crash-edge-case gap documented and a Cloud Function fast-follow tracked separately (§11).
* Students continue tracking the remaining available vehicles.
* Existing route progress continues working without regression (§12).
* The day only closes via the explicit "Close Day" action once every vehicle shows `ended` (§16).
* The cut-over to the new data model happens with no trip in progress, and no code path depends on the old `trips`/`dailyStatus.boarded` shape after deploy (§15).
* Security rules restrict vehicle, GPS, and boarding writes to coordinators, and GPS writes further to the currently-assigned coordinator (§17).
