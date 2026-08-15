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

  // If there are no custom courses created yet, show default indicator
  const activeCourseName = course?.name || (courseId === "default" ? "الدورة الأساسية" : courseId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-150 active:scale-95 border border-primary/20 text-xs font-bold outline-none cursor-pointer">
        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate max-w-[110px] sm:max-w-[160px]">{activeCourseName}</span>
        <ChevronDown className="w-3.5 h-3.5 text-primary/70 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56 p-1.5 rounded-2xl shadow-elevated">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1.5">
          التبديل بين الدورات
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        {/* Default course option */}
        <DropdownMenuItem
          onClick={() => setCourseId("default")}
          className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
            courseId === "default" ? "bg-primary/10 text-primary font-bold" : ""
          }`}
        >
          <div className="flex flex-col">
            <span>الدورة الأساسية</span>
            <span className="text-[10px] text-muted-foreground font-mono">default</span>
          </div>
          {courseId === "default" && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>

        {/* Custom courses list */}
        {courses.map((c) => {
          const isSelected = c.id === courseId;
          const isArchived = c.status === "archived";
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
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-muted-foreground font-mono truncate">{c.id}</span>
                  {isArchived && (
                    <span className="text-[9px] bg-muted px-1.5 py-0.2 rounded-full text-muted-foreground">
                      مؤرشفة
                    </span>
                  )}
                </div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem asChild>
          <Link
            to="/admin/settings"
            className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-primary py-2 rounded-xl hover:bg-primary/10 transition-colors"
          >
            ⚙️ إدارة وإنشاء الدورات
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
