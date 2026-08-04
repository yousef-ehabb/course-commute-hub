import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, ButtonProps } from "./button";
import { cn } from "@/lib/utils";

interface LongPressButtonProps extends ButtonProps {
  onComplete: () => void;
  holdDuration?: number; // in milliseconds
}

export function LongPressButton({
  onComplete,
  holdDuration = 1500,
  className,
  children,
  disabled,
  ...props
}: LongPressButtonProps) {
  const [isPressing, setIsPressing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    setIsPressing(true);
    timeoutRef.current = setTimeout(() => {
      setIsPressing(false);
      onComplete();
    }, holdDuration);
  };

  const endPress = () => {
    if (disabled) return;
    setIsPressing(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Button
      className={cn("relative overflow-hidden touch-none select-none", className)}
      disabled={disabled}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchCancel={endPress}
      {...props}
    >
      <AnimatePresence>
        {isPressing && (
          <motion.div
            initial={{ width: 0, opacity: 0.2 }}
            animate={{ width: "100%", opacity: 0.4 }}
            exit={{ width: 0, opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: holdDuration / 1000, ease: "linear" }}
            className="absolute left-0 top-0 bottom-0 bg-black dark:bg-white z-0 pointer-events-none"
          />
        )}
      </AnimatePresence>
      <span className="relative z-10 flex items-center justify-center gap-2 w-full">
        {children}
      </span>
    </Button>
  );
}
