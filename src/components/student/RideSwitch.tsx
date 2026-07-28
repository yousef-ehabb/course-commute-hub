import { motion, AnimatePresence } from "framer-motion";
import { Bus, Check, X, Lock } from "lucide-react";

interface RideSwitchProps {
  status: "riding" | "cancelled";
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  locked?: boolean;
}

export function RideSwitch({ status, onChange, disabled, locked }: RideSwitchProps) {
  const isRiding = status === "riding";

  return (
    <div
      className={`relative rounded-2xl p-6 transition-all duration-500 shadow-card ${
        locked ? "bg-muted/30" : isRiding ? "bg-success/5 ring-1 ring-success/15" : "bg-card"
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        {/* Status Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={locked ? "locked" : isRiding ? "on" : "off"}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="text-center"
          >
            <h2 className={`text-xl font-bold ${locked ? "text-muted-foreground" : isRiding ? "text-success" : "text-foreground"}`}>
              {locked 
                ? (isRiding ? "تم تأكيد الحضور ✓" : "لم يتم التأكيد ✕") 
                : isRiding 
                  ? "تم تأكيد الحضور ✓" 
                  : "لم يتم تأكيد الحضور"}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
              {locked && <Lock className="w-3.5 h-3.5" />}
              {locked 
                ? "انتهى وقت التسجيل ولا يمكن تغيير الحالة" 
                : isRiding 
                  ? "أنت مسجل في باص اليوم" 
                  : "اضغط لتأكيد حضورك اليوم"}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Large Custom Toggle */}
        <button
          onClick={() => !disabled && !locked && onChange(!isRiding)}
          disabled={disabled || locked}
          className={`relative w-[150px] h-[64px] rounded-full transition-colors duration-300 cursor-pointer flex items-center p-[6px] ${
            locked ? "bg-gray-300 dark:bg-gray-700 cursor-not-allowed justify-center" : 
            disabled ? "opacity-50 cursor-not-allowed " + (isRiding ? "bg-success justify-end" : "bg-muted justify-start") :
            isRiding ? "bg-success shadow-[0_0_0_4px_rgba(34,197,94,0.1)] justify-end" : "bg-muted justify-start"
          }`}
          aria-label={isRiding ? "إلغاء الحضور" : "تأكيد الحضور"}
          dir="ltr"
        >
          <motion.div
            layout
            className={`w-[52px] h-[52px] rounded-full flex items-center justify-center z-10 ${locked ? "bg-gray-100 dark:bg-gray-800 shadow-inner" : "bg-white shadow-elevated"}`}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          >
            <AnimatePresence mode="wait">
              {locked ? (
                <motion.div
                  key="locked"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Lock className="w-6 h-6 text-gray-400" strokeWidth={2} />
                </motion.div>
              ) : isRiding ? (
                <motion.div
                  key="bus"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ duration: 0.2 }}
                >
                  <Bus className="w-6 h-6 text-success" strokeWidth={2} />
                </motion.div>
              ) : (
                <motion.div
                  key="x"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="w-6 h-6 text-muted-foreground" strokeWidth={2} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Background labels */}
          <div className="absolute inset-0 pointer-events-none" dir="rtl">
            {locked ? (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* No text needed, lock icon is centered */}
              </div>
            ) : (
              <>
                <div
                  className={`absolute top-0 bottom-0 left-0 w-[92px] flex items-center justify-center transition-opacity duration-200 ${
                    isRiding ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="text-[16px] font-bold text-white tracking-wide">
                    تأكيد
                  </span>
                </div>
                <div
                  className={`absolute top-0 bottom-0 right-0 w-[92px] flex items-center justify-center transition-opacity duration-200 ${
                    !isRiding ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="text-[15px] font-bold text-muted-foreground/80 tracking-wide">
                    إلغاء
                  </span>
                </div>
              </>
            )}
          </div>
        </button>

        {/* Subtle footer hint */}
        {!locked && (
          <p className="text-[11px] text-muted-foreground/60">
            الحالة الافتراضية «تأكيد الحضور» — قم بإلغاء التأكيد إذا كنت لن تحضر اليوم
          </p>
        )}
      </div>
    </div>
  );
}
