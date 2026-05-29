/** Whole-euro formatters. No decimals, no cents — round at display time only. */

export function fmtEur(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "−" : "";
  return sign + "€" + Math.abs(v).toLocaleString("en-US");
}

export function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** "20k", "1M", "500" — compact plain-number form for slider tick labels.
 *  Compacts at >=1000; values under 1000 print in full. */
export function fmtCompactNum(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000)
    return sign + (abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1).replace(/\.0$/, "") + "M";
  if (abs >= 1_000)
    return sign + (abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1).replace(/\.0$/, "") + "k";
  return String(n);
}

/** "+€120k", "+€8.1M", "+€2B" — compact form for delta chips. */
export function fmtCompactEur(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  if (abs >= 1_000_000_000)
    return sign + "€" + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1_000_000)
    return sign + "€" + (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 10_000) return sign + "€" + Math.round(abs / 1_000) + "k";
  if (abs >= 1_000)
    return sign + "€" + (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return sign + "€" + abs;
}
