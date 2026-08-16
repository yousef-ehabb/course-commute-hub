/**
 * Filter a list of user profiles to only include students belonging to a specific course.
 *
 * - Excludes admins
 * - Matches users whose `courseId` equals the given `courseId`
 * - For backwards compatibility, users without a `courseId` are included
 *   when `courseId` is `"default"`
 */
export function filterStudentsByCourse<T extends { role?: string; courseId?: string }>(
  users: T[],
  courseId: string,
): T[] {
  return users.filter(
    (u) =>
      u.role !== "admin" &&
      (u.courseId === courseId || (!u.courseId && courseId === "default")),
  );
}
