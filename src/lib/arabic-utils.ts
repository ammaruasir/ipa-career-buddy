const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

/** Convert Western digits to Arabic-Indic numerals: 1234 → ١٢٣٤ */
export const toArabicNumerals = (value: string | number): string => {
  return String(value).replace(/\d/g, (d) => arabicDigits[parseInt(d)]);
};

/** Format a number with Arabic numerals and proper separators: 1,234.56 → ١٬٢٣٤٫٥٦ */
export const formatArabicNumber = (num: number, decimals = 0): string => {
  const formatted = num.toLocaleString("ar-SA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return formatted;
};

/** Format percentage with Arabic numerals: 85 → ٨٥٪ */
export const formatArabicPercent = (num: number): string => {
  return `${toArabicNumerals(Math.round(num))}٪`;
};
