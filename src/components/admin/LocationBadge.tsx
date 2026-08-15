import { MapPin, MapPinOff, AlertTriangle } from "lucide-react";
import { PermissionState } from "@/hooks/useAdminLocationTracking";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LocationBadgeProps {
  permissionState: PermissionState;
  requestPermission: () => void;
}

export function LocationBadge({ permissionState, requestPermission }: LocationBadgeProps) {
  // If granted or unknown (pre-prompt or unsupported without failure), 
  // we can choose to be silent or subtle to avoid alarm fatigue.
  if (permissionState === "granted") {
    return null;
  }

  if (permissionState === "denied") {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-lg border border-destructive/20 cursor-help">
              <MapPinOff className="w-4 h-4" />
              <span className="text-xs font-semibold whitespace-nowrap">الموقع محظور</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[200px] text-center">
            <p>تم حظر الوصول لموقعك. يرجى تفعيله من إعدادات المتصفح لمشاركة موقع المركبة.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // prompt state
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={requestPermission}
      className="h-8 flex items-center gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 hover:text-amber-700 transition-colors rtl:font-medium"
    >
      <AlertTriangle className="w-4 h-4" />
      <span className="text-xs whitespace-nowrap">الموقع غير مفعل</span>
    </Button>
  );
}
