# Phase 2 Implementation Plan – Multi-Vehicle Transportation (MVP) — v2

This phase focuses **only** on supporting multiple transportation vehicles for a single transportation day. **Multi-course support will be implemented later**. The goal is to keep the current workflow intact while allowing coordinators to manage multiple buses or microbuses simultaneously.

*v2 changes: atomic vehicle assignment, explicit control-release flow, boarding-record-derived occupancy, undo/un-board support, clarified Mark Full semantics, server-triggered notifications, an explicit shared-route assumption, and security rules for the no-RBAC coordinator model.*

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
* Student notifications (server-triggered).

This phase **does NOT** include:

* Multiple courses.
* Driver accounts.
* Role-based permissions.
* Fleet management.
* Vehicle history.

Those belong to Phase 3.

---

# Key Design Assumption

All vehicles in a given transportation day serve the **same route and the same set of pickup points**, in parallel. This is why a single shared boarding list works. Splitting vehicles across different stops or routes is explicitly out of scope for Phase 2 and would require a different data model (per-vehicle route assignment) in a later phase.

---

# 1. Multiple Coordinator Accounts

Before implementing the transportation changes, migrate away from the single shared admin account.

Create three default Firebase Authentication accounts.

| Display Name | Email                                       |
| ------------ | ------------------------------------------- |
| Admin 1      | [admin1@rakeb.com](mailto:admin1@rakeb.com) |
| Admin 2      | [admin2@rakeb.com](mailto:admin2@rakeb.com) |
| Admin 3      | [admin3@rakeb.com](mailto:admin3@rakeb.com) |

Requirements:

* All coordinators have identical permissions.
* No RBAC.
* Every coordinator can manage everything.
* Future coordinators can be added without changing the architecture.

**Security note:** "No RBAC" means all coordinators are equally trusted — it does not mean anyone with a Firebase account should be able to write to vehicle/boarding data. Firestore security rules must restrict writes to a fixed allowlist of coordinator UIDs (or a `role == "coordinator"` custom claim), independent of the student-facing auth used for attendance confirmation. This keeps the "flat permissions" simplicity while still enforcing real access control server-side.

---

# 2. Replace the Single Vehicle Model

Currently the system assumes there is exactly one active vehicle.

Replace it with a collection of active vehicles.

Instead of:

```
Today's Vehicle
```

The system should support:

```
Vehicle 1

Vehicle 2

Vehicle 3
```

Every vehicle is completely independent.

---

# 3. Vehicle Types

Only two vehicle types are required for the MVP.

```
Bus

Microbus
```

Do not add any other vehicle types.

Vehicle identity is temporary. There is no permanent plate number or saved fleet. Every transportation day creates new temporary vehicles.

Example:

```
Bus

Capacity: 50
```

```
Microbus

Capacity: 14
```

---

# 4. Transportation Planning

After registration closes:

Coordinator opens the dashboard. The system displays:

```
Confirmed Students

83
```

Coordinator manually creates transportation.

Example:

```
+ Add Vehicle

Bus

Capacity 50
```

```
+ Add Vehicle

Microbus

Capacity 14
```

```
+ Add Vehicle

Microbus

Capacity 20
```

Dashboard immediately displays:

```
Confirmed Students

83

Total Capacity

84

Remaining Seats

1

Status

Enough Capacity
```

If capacity becomes insufficient:

```
Confirmed Students

83

Capacity

70

Missing Seats

13
```

Display a warning.

---

# 5. Vehicle Assignment (Take Control / Release Control)

Every vehicle can only be controlled by **one coordinator at a time**.

## 5.1 Taking control

Taking control must be an **atomic check-and-set**, not a client-side read followed by a write. If two coordinators tap "Take Control" on the same vehicle within milliseconds of each other, a naive read-then-write can let both succeed. This must be implemented as a Firestore transaction or a Cloud Function:

```
transaction:
  read vehicle.assignedCoordinatorId
  if it is not null and not expired -> reject ("Controlled by <name>")
  else -> set assignedCoordinatorId = currentUser.id, assignedAt = now()
```

Workflow:

```
Admin 1 logs in.
Selects: Take Control → Bus
Vehicle becomes: Assigned → Admin 1

Admin 2 logs in.
Bus is already assigned.
UI disables controlling that vehicle and displays: Controlled by Admin 1
Admin 2 chooses another vehicle.
```

## 5.2 Releasing control

The original plan had no way to release a vehicle once claimed. This phase must support both:

* **Explicit release** — a "Release / End Tracking" action that clears `assignedCoordinatorId` and stops the tracking session for that vehicle.
* **Automatic staleness recovery** — if a coordinator's app crashes or their session goes stale (e.g. no GPS heartbeat for a defined timeout, or the client disconnects), the vehicle should be releasable by another coordinator rather than staying locked for the rest of the day. This can be a simple `lastHeartbeatAt` timestamp checked before allowing another coordinator to take control, or a scheduled Cloud Function that clears stale assignments.

This prevents a crashed or closed app from permanently locking a vehicle.

---

# 6. Independent Live Tracking

Every vehicle has its own live tracking session.

Example:

```
Bus

GPS A
```

```
Microbus

GPS B
```

```
Microbus

GPS C
```

Each assigned coordinator starts GPS tracking only for the vehicle assigned to them. Students should see every active vehicle moving independently on the map.

---

# 7. Shared Boarding List (with Undo)

This is one of the most important requirements.

There should NOT be a passenger list for every vehicle. Instead, every vehicle displays the exact same student list.

Example:

```
Ahmed

Waiting
```

Admin 1 checks Ahmed into the Bus. Immediately, Ahmed becomes:

```
Boarded
```

inside **every** vehicle interface. Admin 2 should instantly see Ahmed already boarded.

Students can board **any available vehicle**. They are **not assigned** to specific vehicles.

## 7.1 Undo / un-board

Mis-taps are inevitable — a coordinator will check the wrong student into the wrong vehicle. Phase 2 must support reversing a boarding action:

* Coordinator can select a "Boarded" student and choose **Undo Boarding**, returning them to `Waiting`.
* This must decrement the correct vehicle's occupancy (see §8) and clear the boarding record's active status rather than deleting it outright, so the correction itself is auditable.

---

# 8. Vehicle Occupancy (Derived, Not a Raw Counter)

Each vehicle displays its own occupancy:

```
Bus

37 / 50
```

```
Microbus

8 / 14
```

**Do not treat `occupiedSeats` as a standalone field that gets blindly incremented/decremented on every tap.** A raw counter drifts over time from double-taps, retried network requests, or the undo flow in §7.1 — and once it drifts, there's no way to tell which number is right.

Instead:

* Occupancy should be computed from a **count of active boarding records** for that vehicle (`status: boarded`), either via a transaction that increments a denormalized counter *as part of* the same write that creates the boarding record, or recomputed from the boarding records themselves if a reconciliation is ever needed.
* Boarding a student (§7) and undoing a boarding (§7.1) must update the vehicle's `occupiedSeats` in the **same transaction** as the boarding record write, so the counter and the underlying records can never disagree.

---

# 9. Manual & Automatic Full Status

Support both workflows.

**Automatic:** When occupancy reaches `50 / 50`, the vehicle automatically becomes `Full`.

**Manual:** Coordinator may manually press `Mark Vehicle Full` even if seats remain. Reason: some students may not have registered but are already onboard, so the true occupancy exceeds what the app can count.

## Clarified semantics

Marking a vehicle Full manually (with seats technically remaining):

* **Does** immediately hide the vehicle from students' active tracking list and trigger the "reached capacity" notification (§11).
* **Does not** block a coordinator from continuing to check registered students into that vehicle — since the entire reason for the manual override is that the vehicle has unregistered riders aboard, coordinators may still need to board a few more confirmed students who are physically already on it.
* The UI should show a soft warning (not a hard block) if a coordinator marks a vehicle Full while `occupiedSeats < capacity`, so it's a deliberate action rather than an accidental tap.

---

# 10. Student Experience

Students can now see multiple vehicles.

Example:

```
🚌 Bus

Running

37 / 50
```

```
🚐 Microbus

Waiting

0 / 14
```

```
🚐 Microbus

Waiting

0 / 20
```

Students can follow every vehicle.

---

# 11. Full Vehicle Notification (Server-Triggered)

When a vehicle's `status` transitions to `Full` (automatic or manual), students receive a banner, e.g.:

```
The first bus has reached capacity.

Please follow the first microbus.
```

Additionally, hide the completed vehicle from the student's active tracking section. Students should naturally continue following the remaining available vehicles.

## Delivery mechanism

This must **not** be triggered client-side by the coordinator's own app (e.g. "call the notification API right after I press Mark Full"), because if that coordinator's app crashes or loses connectivity immediately after the tap, the notification is silently lost even though the database was updated.

Instead, use a **Cloud Function triggered on the vehicle document's `status` field transition** (`onUpdate`, checking `before.status != "full" && after.status == "full"`). This guarantees the notification fires whenever the state actually changes, regardless of which client caused it or what happened to that client afterward. It should send via FCM push (not just in-app banner) so it reaches students whose app is backgrounded.

---

# 12. Route Progress

No changes required. The existing Route Progress implementation should continue working independently for every vehicle.

---

# 13. Coordinator Dashboard

Transportation page should become an operations dashboard. Each vehicle card should display:

```
Vehicle Type
Capacity
Occupied Seats
Status
Assigned Coordinator
GPS Status
Route Progress
Take Control
Release Control
Start Tracking
Mark Full
End Tracking
```

---

# 14. Database Changes

**Vehicles collection** — every vehicle should store:

```
id
type
capacity
occupiedSeats          // denormalized, kept in sync transactionally with boarding records
status                 // e.g. planned | running | full | ended
assignedCoordinatorId
assignedAt
lastHeartbeatAt         // for stale-assignment recovery
trackingSessionId
currentLocation
createdAt
updatedAt
```

**Boarding records** — separate from the vehicle document, to support derived occupancy and undo:

```
id
studentId
vehicleId
status                  // boarded | undone
boardedAt
boardedByCoordinatorId
undoneAt (nullable)
```

---

# 15. Student Boarding Record

Although students are not permanently assigned to a vehicle, every boarding action should record which vehicle they actually boarded (see §14 boarding records). Example:

```
Student
Ahmed

Boarded Vehicle
Bus

Boarded At
08:37
```

This enables future reporting and analytics, and supports the undo flow in §7.1.

---

# 16. Security Rules Summary

* **Coordinator writes** (vehicle status, control assignment, boarding records, GPS updates) — restricted server-side to the fixed set of coordinator UIDs (or a coordinator custom claim), regardless of the "no RBAC among coordinators" design decision.
* **Take Control writes** — only permitted via transaction/Cloud Function logic that enforces the atomic check described in §5.1; rules should reject direct client writes to `assignedCoordinatorId` that skip this check where possible (or this logic should live entirely in a Cloud Function callable rather than a direct Firestore write).
* **Student reads** — read-only access to vehicle status/location and their own boarding record; no write access to occupancy, status, or other students' records.

---

# 17. MVP Acceptance Criteria

The implementation is complete when:

* Multiple vehicles can exist simultaneously.
* Vehicles have independent GPS tracking.
* Only one coordinator controls each vehicle at a time, enforced atomically (no double-assignment race).
* A vehicle's control can be released explicitly or recovered automatically after staleness.
* Multiple coordinators can work at the same time.
* Boarding status syncs instantly across every vehicle.
* Boarding actions can be undone without corrupting occupancy counts.
* Vehicle occupancy is always consistent with the underlying boarding records.
* Vehicles can become Full automatically or manually, with manual Full not blocking further boarding of already-confirmed students.
* Students receive clear, reliably-delivered notifications when a vehicle becomes full, triggered server-side.
* Students continue tracking the remaining available vehicles.
* Existing route progress continues working without regression.
* Coordinator writes are restricted server-side to the coordinator allowlist.
