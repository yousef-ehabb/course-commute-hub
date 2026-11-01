import type { CoursePaymentConfig, TransportationType } from "@/types";

/**
 * Standard Arabic labels for transportation types
 */
export const TRANSPORTATION_TYPE_LABELS: Record<TransportationType, string> = {
  roundTrip: "ذهاب وعودة",
  returnOnly: "عودة فقط",
};

/**
 * Resolves the applicable daily fee for a given transportation type and course payment settings.
 *
 * Rules:
 * - Free course -> 0
 * - Round trip -> payment.dailyFee (or 0)
 * - Return only -> payment.returnOnlyDailyFee ?? payment.dailyFee ?? 0
 *   (falls back to dailyFee if returnOnlyDailyFee is not configured for backward compatibility)
 * - Missing/undefined transportationType -> defaults safely to "roundTrip"
 */
export function getDailyFeeForType(
  payment?: CoursePaymentConfig | null,
  transportationType?: TransportationType | string | null
): number {
  if (!payment || payment.isFree) return 0;

  const type: TransportationType =
    transportationType === "returnOnly" ? "returnOnly" : "roundTrip";

  if (type === "returnOnly") {
    if (typeof payment.returnOnlyDailyFee === "number") {
      return payment.returnOnlyDailyFee;
    }
    return payment.dailyFee || 0;
  }

  return payment.dailyFee || 0;
}

/**
 * Calculates the total transportation fee based on duration and applicable daily fee.
 *
 * Formula:
 * totalFee = transportationDays * applicableDailyFee
 *
 * Free courses always return 0.
 */
export function calculateTransportationFee(
  payment?: CoursePaymentConfig | null,
  transportationType?: TransportationType | string | null
): number {
  if (!payment || payment.isFree) return 0;

  const days = Math.max(0, payment.days || 0);
  const dailyRate = getDailyFeeForType(payment, transportationType);
  return days * dailyRate;
}

/**
 * Returns the human-readable Arabic label for a transportation type.
 * Defaults safely to "ذهاب وعودة" if missing or invalid.
 */
export function getTransportationTypeLabel(
  transportationType?: TransportationType | string | null
): string {
  if (transportationType === "returnOnly") {
    return "عودة فقط";
  }
  return "ذهاب وعودة";
}

