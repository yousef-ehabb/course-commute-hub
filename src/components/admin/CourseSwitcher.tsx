import { useCourse } from "@/contexts/CourseContext";
import { Layers, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";

export function CourseSwitcher() {
  const { courseId, courses, setCourseId, course } = useCourse();

  // Combine default with custom courses
  const defaultCourse = courses.find((c) => c.id === "default") || {
    id: "default",
    name: "الكورس الأساسي",
    adminUid: "system",
    status: "active",
    createdAt: 0,
    startDate: 0,
  };

  const allCourses = [
    defaultCourse,
    ...courses.filter((c) => c.id !== "default"),
  ];

  // Exclude archived courses from the switcher dropdown
  const activeCourses = allCourses.filter((c) => c.status !== "archived");

  // If there are no custom courses created yet, show default indicator
  const activeCourseName = course?.name || (courseId === "default" ? "الكورس الأساسي" : courseId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-150 active:scale-95 border border-primary/20 text-xs font-bold outline-none cursor-pointer">
        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[110px] sm:max-w-[160px]">{activeCourseName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-primary/70 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56 p-1.5 rounded-2xl shadow-elevated">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1.5">
          التبديل بين الكورسات
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        {activeCourses.length === 0 ? (
          <div className="px-3 py-3 text-center text-xs text-muted-foreground">
            لا توجد كورسات نشطة حالياً
          </div>
        ) : (
          activeCourses.map((c) => {
            const isSelected = c.id === courseId;
            return (
              <DropdownMenuItem
                key={c.id}
                onClick={() => setCourseId(c.id)}
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
                  isSelected ? "bg-primary/10 text-primary font-bold" : ""
                }`}
              >
                <div className="flex flex-col min-w-0 pr-1">
                  <span className="truncate">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">{c.id}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            );
          })
        )}

        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem asChild>
          <Link
            to="/admin/settings"
            className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-primary py-2 rounded-xl hover:bg-primary/10 transition-colors"
          >
            ⚙️ إدارة وإنشاء الكورسات
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
