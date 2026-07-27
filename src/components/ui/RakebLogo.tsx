import { cn } from "@/lib/utils";

interface RakebLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showText?: boolean;
  textClassName?: string;
  imgClassName?: string;
}

const sizeConfig = {
  sm: {
    container: "gap-2",
    img: "w-8 h-8",
    text: "text-base font-bold",
  },
  md: {
    container: "gap-2.5",
    img: "w-10 h-10",
    text: "text-lg font-bold",
  },
  lg: {
    container: "gap-3",
    img: "w-14 h-14",
    text: "text-2xl font-extrabold",
  },
  xl: {
    container: "gap-3.5",
    img: "w-16 h-16",
    text: "text-3xl font-extrabold",
  },
};

export function RakebLogo({
  size = "md",
  className,
  showText = false,
  textClassName,
  imgClassName,
}: RakebLogoProps) {
  const config = sizeConfig[size];

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center select-none",
        config.container,
        className,
      )}
    >
      <img
        src="/logo.png"
        alt="راكب"
        className={cn(
          "object-contain rounded-full transition-transform duration-200 hover:scale-105 drop-shadow-sm",
          config.img,
          imgClassName,
        )}
      />
      {showText && (
        <span
          className={cn("text-primary tracking-tight leading-none", config.text, textClassName)}
        >
          راكب
        </span>
      )}
    </div>
  );
}
