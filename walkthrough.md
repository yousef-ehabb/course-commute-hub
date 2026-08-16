# Multi-Course Architecture Implemented

I have successfully completed the migration to the Multi-Course architecture (Option 2), allowing multiple admins to independently manage separate active courses while sharing the same underlying vehicle and station infrastructure.

## Key Changes Made

### 1. Registration Flow (`register.tsx` & `AuthContext`)
- **Query Parameter Support:** Students can now register via specialized links like `https://rakeb.app/register?course=intake-42`.
- **Profile Tagging:** The `courseId` is seamlessly passed into the user's `UserProfile` in the Firebase Realtime Database upon successful signup. 

### 2. Course Management UI (`settings.tsx`)
Added a new dedicated section for **Course Management** inside the Settings page:
- **Create New Course:** Admins can create a new course by specifying a unique ID and Name. This automatically sets up the initial `rakeb/settings/{courseId}` configurations.
- **Archive Course:** When a course ends, admins can click "Archive". This executes a local migration that:
  - Fetches all users scoped to the current `courseId`.
  - Safely copies their records to a read-only `rakeb/archivedUsers/{courseId}/{uid}` node.
  - Removes them from the active `rakeb/users` node.
  - Marks the course as `archived` in `rakeb/courses`.

> [!NOTE]
> Since this is a purely client-side application without Firebase Cloud Functions, students' Firebase Auth accounts remain intact, but because their `rakeb/users` profile is removed, they are completely disabled from accessing the active Rakeb system.

### 3. Deep Context Propagation (`CourseContext.tsx`)
- Built and injected `CourseProvider` into the routing layer. 
- All hooks, services, and queries (`useTodayStatus`, `useTripStatus`, `tripService`, `TripRepository`, etc.) now dynamically construct database paths based on the `courseId` provided by the context (e.g., `rakeb/trips/{courseId}`).

### 4. Shared Fleet Architecture
- **Vehicles & Stations:** Modified the hooks and `database.rules.json` to keep vehicles and stations fully global. This guarantees that multiple courses running simultaneously can still coordinate boarding on the same shared physical buses.

### 5. Admin Dashboard & Student Listings
- `students.tsx` and `dashboard.lazy.tsx` now filter the master user list to exclusively show and calculate stats for students belonging to the currently active admin's `courseId` (or the `default` fallback for legacy compatibility).

### Testing Your Changes

You can run your dev server (`npm run dev`) and try the following:
1. Navigate to `/admin/settings` to see the new Course Management cards.
2. Create a test course (e.g., `test-42`).
3. Open an Incognito window and navigate to `/register?course=test-42` and create a dummy account.
4. Verify in the database that the dummy user was tagged with `courseId: "test-42"`.
5. Login with an admin account configured to manage `test-42` (you can manually set your admin profile's `courseId` to `test-42` in the Firebase Console) and observe the isolation in action!
