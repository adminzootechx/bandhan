/** Published fares exclude taxes; the asterisk on every price points at this note. */
export const TAX_NOTE = "*Taxes applicable";

const rupeeFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** "28000" -> "₹28,000/-*" (Indian digit grouping, e.g. "₹1,25,000/-*"). */
function rupees(amount: string): string {
  return `₹${rupeeFormat.format(Number(amount.replace(/,/g, "")))}/-*`;
}

/** Normalize explicitly marked rupee amounts within prose, preserving other figures. */
export function formatPriceText(text: string): string {
  return text.replace(
    /(?:₹\s*|\b(?:INR|Rs\.?)\s+)(\d[\d,]*(?:\.\d+)?)(?:\s*\/-)?(?:\s*\*+)?|(\d[\d,]*(?:\.\d+)?)(?:\s*\/-)(?:\s*\*+)?/gi,
    (_match, currencyAmount: string | undefined, suffixedAmount: string | undefined) =>
      rupees(currencyAmount ?? suffixedAmount ?? "")
  );
}

/** "₹62,499", "62499*" and "62499/-*" all display as "₹62,499/-*". */
export function withTaxMark(price: string | number | null | undefined): string {
  const value = String(price ?? "").trim();
  if (/^\d[\d,]*(?:\.\d+)?\**$/.test(value)) {
    return rupees(value.replace(/\*/g, ""));
  }
  return formatPriceText(value);
}
