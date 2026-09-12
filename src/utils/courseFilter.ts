/**
 * Check if a user is payment-active and eligible for main student views.
 *
 * Rules:
 * - Non-students (e.g. staff, admin) -> true
 * - Student with paymentStatus === "active" -> true
 * - Student with "pending_payment" -> false
 * - Student with "payment_submitted" -> false
 * - Student with "payment_rejected" -> false
 * - Student with missing/undefined/empty paymentStatus -> true (backward compatibility)
 */
export function isStudentPaymentActive(
  user?: { role?: string; paymentStatus?: string } | null,
): boolean {
  if (!user) return false;
  if (user.role && user.role !== "student") return true;

  const status = (user.paymentStatus || "").trim();
  if (!status) return true;

  if (status === "active") return true;
  if (
    status === "pending_payment" ||
    status === "payment_submitted" ||
    status === "payment_rejected"
  ) {
    return false;
  }

  return false;
}

/**
 * Filter a list of user profiles to include students belonging to a specific course
 * or all active courses when courseId is "all".
 *
 * - Excludes admins
 * - When "all": returns students from all active courses; excludes non-student users;
 *   does not let "all" accidentally match a real courseId
 * - For backwards compatibility, users without a courseId are included
 *   when courseId is "default"
 */
export function filterStudentsByCourse<T extends { role?: string; courseId?: string }>(
  users: T[],
  courseId: string,
  activeCourseIds?: Set<string> | string[],
): T[] {
  const activeSet = activeCourseIds
    ? activeCourseIds instanceof Set
      ? activeCourseIds
      : new Set(activeCourseIds)
    : null;

  return users.filter((u) => {
    if (u.role === "admin") return false;

    if (courseId === "all") {
      // Must not match a literal course named "all"
      const uCourse = u.courseId || "default";
      if (uCourse === "all") return false;
      if (activeSet) {
        return activeSet.has(uCourse);
      }
      return true;
    }

    return u.courseId === courseId || (!u.courseId && courseId === "default");
  });
}

/**
 * Filter a list of user profiles to include all students across all courses.
 * Excludes admins.
 */
export function getAllStudents<T extends { role?: string }>(users: T[]): T[] {
  return users.filter((u) => u.role !== "admin");
}
