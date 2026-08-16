# Rakeb Codebase Review

Reviewed **~45 source files** across contexts, hooks, components, services, types, utils, routes, and security rules.

---

## 🔴 Critical / Bugs

### 1. Security: Firebase secrets committed to git

[`.env`](file:///d:/Course/Projects/rakeb/.env) contains actual Firebase API keys and is tracked by git.

While `.gitignore` lists `.env`, the file **already exists in the repo**. If this was ever committed, the secrets are in git history. Firebase client-side API keys are restricted by security rules (so not catastrophic), but it's still poor practice.

> [!CAUTION]
> Run `git log --all --diff-filter=A -- .env` to verify this file hasn't been pushed. If it has, rotate the API key in Firebase Console.

---

### 2. Security: Debug globals exposed in production

[`firebase.ts:37-43`](file:///d:/Course/Projects/rakeb/src/lib/firebase.ts#L37-L43) — `window.db`, `window.push`, and `window.ref` are exposed in **all environments**, not just dev. Any user can open the console and perform arbitrary database operations.

```typescript
// @ts-ignore
window.db = _db;
// @ts-ignore
window.push = push;
// @ts-ignore
window.ref = ref;
```

> [!CAUTION]
> These should be removed entirely, or at minimum wrapped in `if (import.meta.env.DEV)`.

---

### 3. Bug: `useMemo` dependency mismatch in `StationsContext`

[`StationsContext.tsx:192-201`](file:///d:/Course/Projects/rakeb/src/contexts/StationsContext.tsx#L192-L201) — `saveStations` is **not memoized** (it's a plain `async function`, not wrapped in `useCallback`), yet it's included in the `useMemo` value. Every re-render creates a new `saveStations` reference, defeating `useMemo` and causing unnecessary re-renders for all consumers.

```typescript
const value = useMemo<StationsContextType>(
  () => ({
    stations,
    loading,
    error,
    retry,
    saveStations, // ← new reference on every render!
  }),
  [stations, loading, error, retry], // ← not even listed as a dependency
);
```

**Fix:** Wrap `saveStations` in `useCallback`, or add it to the deps array.

---

### 4. Bug: `StationsContext` top-level imports bypass lazy-loading pattern

[`StationsContext.tsx:11-12`](file:///d:/Course/Projects/rakeb/src/contexts/StationsContext.tsx#L11-L12) — Firebase SDK is imported at the **top-level** (`import { ref, onValue, set } from "firebase/database"`), while the `useEffect` also dynamically imports the same modules. The top-level import pulls the Firebase SDK into the initial bundle even for unauthenticated users, defeating the lazy-loading pattern used everywhere else.

Moreover, `saveStations` on [line 171](file:///d:/Course/Projects/rakeb/src/contexts/StationsContext.tsx#L171) uses the top-level `getFirebaseDb` and `ref`/`set` directly, while the `useEffect` uses dynamic imports. This inconsistency means the `saveStations` path doesn't benefit from code-splitting.

---

### 5. Bug: `useTripStatus` `retry` function is unstable in `useMemo`

[`useTripStatus.tsx:116-143`](file:///d:/Course/Projects/rakeb/src/hooks/useTripStatus.tsx#L116-L143) — The `retry` function is included in the `useMemo` value, but `retry` itself is **not memoized** (it's a plain function). However, `retryCount` is in the deps array which indirectly stabilizes it. The real issue: `retry` is a new function reference each render but not in the deps — this means stale `retry` could be returned if other deps didn't change. Should use `useCallback` for `retry`.

---

### 6. Bug: Race condition in `AuthContext` archived user lookup

[`AuthContext.tsx:157-176`](file:///d:/Course/Projects/rakeb/src/contexts/AuthContext.tsx#L157-L176) — When checking for archived users, the code fetches **all** `archivedUsers` across all courses:

```typescript
const archivedSnap = await get(ref(db, "rakeb/archivedUsers"));
```

This downloads the **entire** archived users collection. For a large system with many courses and archived users, this:
- Creates a **performance bottleneck** (large payload download)
- Iterates all courses client-side (`for...of Object.entries(allCourses)`)
- Only matches the first course found, ignoring the possibility of a user archived in multiple courses

> [!WARNING]
> Consider querying a dedicated index like `rakeb/archivedUsers/_byUid/{uid}` instead of downloading the entire tree.

---

### 7. Bug: `register.tsx` Google sign-up can redirect before profile is saved

[`register.tsx:82-99`](file:///d:/Course/Projects/rakeb/src/routes/register.tsx#L82-L99) — In `handleGoogleSignUp`, if `signInWithGoogle()` succeeds but `currentUser` is null on the next line (rare timing issue), the code navigates to `/student/home` **without creating a profile**:

```typescript
if (currentUser) {
  // ... set up Google user for profile completion
} else {
  navigate({ to: "/student/home", replace: true }); // ← navigates with no profile!
}
```

This user would hit the student dashboard with `profile === null`, likely causing errors or a blank screen.

---

### 8. Bug: `handleCompleteGoogleRegistration` doesn't save `customLocation`

[`register.tsx:102-132`](file:///d:/Course/Projects/rakeb/src/routes/register.tsx#L102-L132) — Unlike `handleReEnroll` and `onSubmit`, the `handleCompleteGoogleRegistration` function does **not** include `customLocation` in the profile when `station === "custom"`:

```typescript
const userProfile = {
  // ...
  defaultStation: station,
  role: "student",
  // ← no customLocation!
};
```

Users who pick a custom station via Google sign-up will lose their custom location data.

---

## 🟡 Important Issues

### 9. Missing `useCallback` for `retry` across multiple hooks

Several hooks define `retry` as a plain function that creates a new reference each render:

| File | Line |
|------|------|
| [`useTripStatus.tsx`](file:///d:/Course/Projects/rakeb/src/hooks/useTripStatus.tsx#L110-L114) | 110-114 |
| [`useVehicles.tsx`](file:///d:/Course/Projects/rakeb/src/hooks/useVehicles.tsx#L121-L125) | 121-125 |
| [`useBoardingRecords.tsx`](file:///d:/Course/Projects/rakeb/src/hooks/useBoardingRecords.tsx#L72-L76) | 72-76 |
| [`useTodayStatus.tsx`](file:///d:/Course/Projects/rakeb/src/hooks/useTodayStatus.tsx#L92-L96) | 92-96 |
| [`useStudentBoardingRecord.tsx`](file:///d:/Course/Projects/rakeb/src/hooks/useStudentBoardingRecord.tsx#L67-L71) | 67-71 |

These are included in `useMemo` values but not listed in deps arrays, creating subtle reference instability.

---

### 10. `useAdminLocationTracking` missing `courseId` in location path

[`useAdminLocationTracking.ts:111`](file:///d:/Course/Projects/rakeb/src/hooks/useAdminLocationTracking.ts#L111) — Location updates are written to `rakeb/vehicles/{dateKey}/{vehicleId}` (via `TripRepository.updateLocation`), which is correct. However, the `activeDateKey` is **not** in the `useEffect` dependency array awareness — if `activeDateKey` is stale when a position update fires, the location is written to the wrong date node.

Actually it IS in the deps at line 136 — however, `permissionState` is also in the deps. This means the watchPosition listener is **torn down and re-created** every time the permission state changes to `"granted"` on the first position callback (line 92). This is wasteful.

---

### 11. `useStaffRideWidget` effect missing `station` dep

[`StaffRideWidget.tsx:47-55`](file:///d:/Course/Projects/rakeb/src/components/admin/StaffRideWidget.tsx#L47-L55) — The `useEffect` to sync initial station reads `station` state but doesn't list it as a dependency:

```typescript
useEffect(() => {
  // ...
  } else if (stations.length > 0 && !station) { // ← reads `station`
    setStation(stations[0].id);
  }
}, [myRecord, profile, stations]); // ← `station` not in deps
```

This is actually intentional (only runs on first load), but the React linter would flag it. Should use a ref or initialization pattern instead.

---

### 12. `vehicleResolver.ts` vs `vehicleLabels.ts` — duplicate API, different signatures

Two files do the same thing with different APIs:

| File | Function | Argument |
|------|----------|----------|
| [`vehicleResolver.ts`](file:///d:/Course/Projects/rakeb/src/utils/vehicleResolver.ts#L7) | `getVehicleLabel(vehicleId: string, vehicles)` | Takes a `vehicleId` string |
| [`vehicleLabels.ts`](file:///d:/Course/Projects/rakeb/src/utils/vehicleLabels.ts#L40) | `getVehicleLabel(vehicle: Vehicle, vehicles)` | Takes a `Vehicle` object |

Both are imported in different parts of the app. This is confusing and error-prone. `StaffRideWidget` imports from `vehicleResolver`, while `useVehicleTabState` imports from `vehicleLabels`.

> [!IMPORTANT]
> Consolidate into a single module with one canonical API.

---

### 13. Database rules: `boardingRecords` missing student read access at the collection level

[`database.rules.json:87-95`](file:///d:/Course/Projects/rakeb/database.rules.json#L87-L95) — Students can only read their **own** boarding record (`$studentId === auth.uid`), but the **collection-level** read is admin-only. This means `useBoardingRecords` hook (which listens to the entire `boardingRecords/{dateKey}` path) would **fail for students**.

Currently `useBoardingRecords` is likely only used by admin views, but `useStudentBoardingRecord` correctly reads `boardingRecords/{dateKey}/{user.uid}` which is allowed. If any student component accidentally uses the admin hook, it would silently fail.

---

### 14. `TripRepository.takeControl` null-return dummy object trick is fragile

[`TripRepository.ts:482-488`](file:///d:/Course/Projects/rakeb/src/lib/TripRepository.ts#L482-L488) — When the SDK cache is unprimed (`vehicle === null`), the code returns a minimal dummy object. If security rules reject this (e.g., missing required fields), the transaction fails silently. The extensive console.log debugging left in this function also suggests this has been problematic.

> [!WARNING]
> Consider removing the ~15 `console.log` statements left from debugging in [`TripRepository.ts:464-522`](file:///d:/Course/Projects/rakeb/src/lib/TripRepository.ts#L464-L522). These add noise to production logs.

---

## 🔵 Minor / Style Issues

### 15. `ActiveDateContext` doesn't reset `activeDateKey` when settings have no `activeDateKey`

[`ActiveDateContext.tsx:82`](file:///d:/Course/Projects/rakeb/src/contexts/ActiveDateContext.tsx#L82) — If the Firebase settings snapshot exists but has no `activeDateKey`, the state keeps the previous value (from `getTodayKey()`). This is likely fine but could cause stale date if an admin explicitly removes the key.

---

### 16. `TripControls` completed state re-uses `onStartTrip`

[`TripControls.tsx:199-211`](file:///d:/Course/Projects/rakeb/src/components/admin/TripControls.tsx#L199-L211) — When the trip is `completed`, clicking "بدء رحلة جديدة" calls `onStartTrip("")`. This reuses the start trip flow which may have unintended side effects if the parent doesn't expect a start call after completion.

---

### 17. `completeTrip` uses `Date.now()` as fallback for `endedAt` in stale cleanup

[`TripRepository.ts:263`](file:///d:/Course/Projects/rakeb/src/lib/TripRepository.ts#L263) — `tripData.endedAt ?? Date.now()` uses the **client** time when the actual end time is unknown. This may be inaccurate if the client's clock is off.

---

### 18. `CourseContext` doesn't handle `localStorage` SSR correctly

[`CourseContext.tsx:43-49`](file:///d:/Course/Projects/rakeb/src/contexts/CourseContext.tsx#L43-L49) — The initial state uses `localStorage.getItem(STORAGE_KEY)`, but [`line 66`](file:///d:/Course/Projects/rakeb/src/contexts/CourseContext.tsx#L66) also accesses `localStorage` directly without the `typeof window` guard.

---

### 19. Unused imports in `StationsContext`

[`StationsContext.tsx:11-12`](file:///d:/Course/Projects/rakeb/src/contexts/StationsContext.tsx#L11-L12) — Top-level imports of `getFirebaseDb`, `ref`, `onValue`, `set` are redundant because the same modules are dynamically imported inside the `useEffect`. The top-level imports increase the initial bundle size.

---

## ✅ What's Done Well

- **Atomic updates via `TripRepository.atomicUpdate`** — consistent pattern for multi-path Firebase writes
- **Transaction-based `takeControl`/`releaseControl`** — proper concurrency control for vehicle assignment
- **CAS-based `completeTrip`** — idempotent trip completion with transactional date advance prevents race conditions
- **Audit logging** — consistent audit trail for all trip operations
- **Server time offset** — using Firebase `.info/serverTimeOffset` to prevent clock-manipulation attacks
- **Security rules** — comprehensive RTDB rules with proper admin/student role separation
- **Error boundaries** — proper error handling at the root level with retry functionality
- **Provider composition** — clean context provider hierarchy with proper loading/error states
- **Boarding rollback logic** — `boardStudent`/`unboardStudent` roll back on failure

---

## Priority Fixes

| Priority | Issue | Effort |
|----------|-------|--------|
| 🔴 P0 | Remove `window.db`/`window.push`/`window.ref` from production | 5 min |
| 🔴 P0 | Check `.env` git history for leaked secrets | 5 min |
| 🔴 P1 | Fix `saveStations` missing `useCallback` wrapper | 10 min |
| 🔴 P1 | Add `customLocation` to Google registration profile | 5 min |
| ✅ ~~P2~~ | ~~Remove top-level Firebase imports in `StationsContext`~~ | ~~10 min~~ |
| ✅ ~~P2~~ | ~~Consolidate `vehicleResolver` and `vehicleLabels`~~ | ~~30 min~~ |
| ✅ ~~P2~~ | ~~Clean up `console.log` in `TripRepository.takeControl`~~ | ~~5 min~~ |
| ✅ ~~P2~~ | ~~Wrap `retry` functions in `useCallback` (5 hooks)~~ | ~~20 min~~ |
| ✅ ~~P3~~ | ~~Optimize archived user lookup in AuthContext~~ | ~~1 hour~~ |
| 🔵 P4 | Handle null Google user edge case in register | 10 min |
