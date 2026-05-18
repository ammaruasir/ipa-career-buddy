# خطة نهائية: نشر رسالة التقديم + قوالب CV متمايزة بصريًا

## السياق بعد فحص الـ PRs السابقة
الـ pulls الـ٤ الأخيرة أكملت audit الـ CV-builder كاملًا (١٥/١٥) — لكن بقي بندان غير مكتملَين فعليًا:

| البند | حالة Audit | الحالة الفعلية | الإصلاح |
|---|---|---|---|
| Cover letter | ✅ مغلق | UI + edge function code جاهزان، لكن **الدالة غير منشورة** → 404 | نشر فقط |
| Template selector | ✅ مغلق | ٣ قوالب بنفس HTML تختلف بلون التمييز فقط → لا تمايز بصري حقيقي | إعادة هيكلة فعلية |

كل ما بُني سابقًا سيُحترم: `section_order` (dnd-kit)، `custom_sections`، `CVDateInput` (هجري/ميلادي)، `mergeBilingual`، `PREVIEW_SECTION_RENDERERS`.

---

## ١) نشر دالة `generate-cover-letter`
```
supabase--deploy_edge_functions(["generate-cover-letter"])
```
ثم اختبار حيّ بـ `curl_edge_functions` بمعرّف المسوّدة الحالية للتأكّد من إرجاع `{ ar: { greeting, body, signature, paragraph_count } }`.

## ٢) قوالب CV متمايزة فعلًا

### أ) باك-إند: `supabase/functions/render-cv-pdf/index.ts`
استبدال كتلة `<body>` الموحّدة الحالية بدالة `renderTemplate(template, draft, sections)` تُرجع ٣ تخطيطات منفصلة. كل تخطيط يستهلك نفس `expHtml`, `eduHtml`, `skillsHtml`, إلخ المُبنية مسبقًا، ويحترم `resolveOrder(draft.section_order)`. الدمج ثنائي اللغة (`mergeBilingual`) يبقى كما هو.

| القالب | البنية | لون التمييز |
|---|---|---|
| **modern** (حديث) | عمود واحد، شريط أزرق علوي ممتد بعرض الصفحة، اسم كبير محاذٍ، عناوين أقسام بخط سفلي ملوّن | `#1e40af` |
| **conservative** (محافظ) | عمود واحد كلاسيكي، ترويسة مركّزة بين خطّين أفقيين رفيعين، عناوين Caps + letter-spacing واسع، فواصل رمادية | `#374151` |
| **executive** (تنفيذي) | عمودان (٣٥٪/٦٥٪ مع احترام `dir`)، شريط جانبي بخلفية navy داكنة `#0f172a` يحوي المعلومات الشخصية + `skills` + `languages_structured` تلقائيًا، المحتوى الرئيسي يحترم `section_order` لبقية الأقسام | `#1e3a8a` + جانبي داكن |

### ب) فرونت-إند: `src/components/cv-builder/TemplateGallery.tsx` (جديد)
يستبدل الـ Select في `CVBuilder.tsx` (السطور 451-467). شبكة `grid grid-cols-3 gap-3`، كل بطاقة:
- معاينة HTML/CSS مصغّرة (~200×280) ترسم بنية القالب الحقيقية بمستطيلات رمادية تحاكي النصوص.
- الاسم العربي + وصف سطر واحد (مثلًا: "تنفيذي — عمودان وشريط جانبي داكن").
- حالة محدّد: `border-2 border-primary` + ✓ في الزاوية + `bg-primary/5`.
- النقر يستدعي `update("template", value)` الموجود.

### خارج النطاق
- لا قوالب جديدة بخلاف الثلاثة.
- لا تغيير على dnd-kit reorder، CVDateInput، custom sections، bilingual merge، أو أي بند audit مغلق.
- لا تغيير على قاعدة البيانات.

## التحقّق
1. **رسالة التقديم**: زر "ولّد الرسالة بـ AI" يُرجع نصًّا.
2. **المعرض**: ٣ بطاقات بصرية، النقر يبدّل التحديد ويُحدّث Badge المعاينة.
3. **PDF**: تصدير بكل قالب يُنتج تخطيطًا مختلفًا بصريًا (وليس مجرّد لون)، مع احترام `section_order` و `custom_sections` و bilingual merge.

## الملفات المتأثّرة
- `supabase/functions/generate-cover-letter/index.ts` — نشر فقط
- `supabase/functions/render-cv-pdf/index.ts` — إعادة هيكلة الـ body لـ ٣ تخطيطات
- `src/components/cv-builder/TemplateGallery.tsx` — جديد
- `src/pages/CVBuilder.tsx` — استبدال Select بالمكوّن
