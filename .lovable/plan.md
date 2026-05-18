## Goal
1. Activate **PDF export** for the CV Builder draft (currently shows a "coming soon" toast). The DOCX/PDF export library already exists and works in CV Review.
2. Make the **CV preview and export** render numerals matching the CV language: Arabic (Arabic-Indic digits ٠-٩) for `ar` and `bilingual` drafts; English (0-9) for `en`.

## Scope
- The library `src/lib/cv-export.ts` already handles DOCX + PDF (print-to-PDF window). We will extend it with a `language` option and a digit-localization helper.
- The Builder will gain working PDF and Word export buttons that build a `CVDocumentData` from the in-progress `Draft`.
- The Builder `PreviewStep` will localize digits in the rendered preview.
- CV Review's existing export call sites will pass `language: "ar"` (its data is Arabic). No UI changes there.

## Changes

### 1. `src/lib/cv-export.ts`
- Add `toArabicDigits(s)` and `toEnglishDigits(s)` helpers (replace 0-9 ↔ ٠-٩).
- Add `localizeDigits(s, lang)` that picks the helper based on `"ar" | "en"`.
- Extend `exportToDocx` and `exportToPdf` signatures:
  ```ts
  exportToDocx(data, filename, opts?: { language?: "ar" | "en" })
  exportToPdf(data, filename, opts?: { language?: "ar" | "en" })
  ```
  - Default `language: "ar"` to preserve current behavior.
  - When `language === "en"`: set `rtl = false`, `AlignmentType.LEFT`, English HTML `lang="en" dir="ltr"`, convert digits to ASCII.
  - When `language === "ar"`: keep RTL, convert digits to Arabic-Indic.
  - Apply digit localization to `fullName`, `contact`, every section `title`, and every paragraph line before writing.

### 2. `src/pages/CVBuilder.tsx`
- Import `buildImprovedCV`, `exportToDocx`, `exportToPdf` (or use a new local builder).
- Add a small helper `draftToCV(draft)` that returns `CVDocumentData` from the live `Draft`:
  - `fullName` from `personal_info.full_name`
  - `contact` joined from email/phone/city
  - Sections: Summary (Arabic + English when bilingual), Experience (position + company + period + bullets), Education, Skills (technical/soft/languages), Certifications.
- Replace the "coming soon" toast with two real buttons on the last step (Preview):
  - **تصدير Word (.docx)** → `exportToDocx(data, name.docx, { language })`
  - **تصدير PDF** → `exportToPdf(data, name.pdf, { language })`
  - `language` is `"en"` if `draft.language === "en"`, otherwise `"ar"`.
- In `PreviewStep`, run all displayed text through `localizeDigits(..., effectiveLang)` so the on-screen preview matches the exported file (years, dates, GPA, phone, bullet counts).

### 3. `src/pages/CVReview.tsx`
- Pass `{ language: "ar" }` explicitly to both `exportToDocx` and `exportToPdf` calls so digits in the exported file are Arabic-Indic.

## Files
- **Modify:** `src/lib/cv-export.ts`, `src/pages/CVBuilder.tsx`, `src/pages/CVReview.tsx`
- **No new deps, no DB changes, no edge function changes.**

## Result
- The CV Builder's final step has working "Word" and "PDF" export buttons.
- Arabic drafts (and the bilingual default) show and export Arabic-Indic numerals (٠١٢…), English drafts show ASCII numerals (012…), everywhere the preview/print appears.