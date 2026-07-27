export type UserRole = "student" | "admin";

export interface UserProfile {
  uid: string;
  fullName: string;
  phone: string;
  nationalId: string;
  defaultStation: string;
  role: UserRole;
  courseId?: string;
  createdAt: number;
}

export interface DailyStatus {
  status: "riding" | "cancelled";
  station: string;
  updatedAt: number;
}
