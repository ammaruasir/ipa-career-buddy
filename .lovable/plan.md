# خطة: تحويل أسئلة معالج السيرة إلى مدخلات منظّمة

## النطاق
تحديث الأسئلة 5، 6، 7، 8، 9، 10، 11 من `Textarea` نص حر إلى مدخلات منظّمة احترافية، مع الحفاظ على بقية المنطق (الرجوع، الاقتراحات، الحفظ، التصدير) كما هو.

## الأسئلة بعد التحويل

| # | الحقل | النوع الجديد | الحقول الفرعية |
|---|---|---|---|
| 5 | contact | **form** | email, phone, city, linkedin |
| 6 | experience_history | **repeater** | title, company, from, to, summary |
| 7 | key_achievements | **repeater_simple** | text (سطر واحد لكل إنجاز) |
| 8 | education | **repeater** | degree, major, university, year, gpa (اختياري) |
| 9 | technical_skills | **chips** | إضافة مهارات بـ Enter |
| 10 | languages | **repeater** | language + level (مبتدئ/متوسط/متقدم/طلاقة/الأم) |
| 11 | certifications | **repeater** | name, issuer, year, link (اختياري) |

أسئلة 2، 3، 4، 12، 13، 14، 15، 1 تبقى كما هي.

## التغييرات التقنية

### 1) Edge function — `supabase/functions/cv-interview-step/index.ts`
- توسيع `type` في `QuestionDef`: إضافة `"form" | "repeater" | "repeater_simple" | "chips"`.
- إضافة حقل اختياري `fields?: Array<{ key, label_ar, label_en, type: "text"|"email"|"tel"|"url"|"date"|"choice", required?, choices? }>` لأسئلة form/repeater.
- تحديث `QUESTIONS` للأسئلة السبعة بتعريف `fields` المناسبة.
- تحديث منطق التحقّق في `submit`: إذا كان `answer` JSON منظّم، يُحفظ كما هو (نخزّن `answer` نصاً JSON-مُسلسلاً للحفاظ على بنية العمود الحالية).
- تحديث `buildDraftFromAnswers`:
  - `contact` → قراءة JSON مباشرةً إلى `personal_info`.
  - `experience_history` → خريطة مصفوفة كائنات إلى `experience[]`.
  - `key_achievements` → دمج في `summary` أو حقل مستقل (نضعها كـ bullets في أول وظيفة أو في `achievements` داخل draft).
  - `education` → مصفوفة كائنات `education[]`.
  - `technical_skills` → مصفوفة `skills.technical`.
  - `languages` → مصفوفة `skills.languages` بصيغة `"Arabic (native)"` تُبنى من القيم.
  - `certifications` → مصفوفة `certifications[]`.
- الحفاظ على المُحلّل النصي القديم كاحتياط للجلسات السابقة (إذا لم يكن JSON صالحاً، نعود للسلوك القديم).

### 2) Frontend — `src/pages/CVInterview.tsx`
- إضافة state: `structuredAnswer` (object) إلى جانب `answer` النصي.
- إضافة 4 مكوّنات داخلية صغيرة (في نفس الملف لتجنّب التشتّت):
  - `FormFields` — يرسم حقول `form` في شبكة.
  - `Repeater` — قائمة عناصر قابلة للإضافة/الحذف، كل عنصر يستخدم `FormFields`.
  - `RepeaterSimple` — قائمة عناصر نصية بسيطة (input + زر حذف + زر إضافة).
  - `ChipsInput` — إدخال يضيف شريحة عند Enter/فاصلة، مع زر × على كل شريحة.
- في منطقة عرض السؤال: branch جديد قبل `textarea`/`input` للأنواع الأربعة.
- عند `submit`: إذا كان نوع السؤال منظّماً، نمرّر `JSON.stringify(structuredAnswer)` بدل النص الحر.
- عند `goBack`: قراءة `previous_answer` ومحاولة `JSON.parse` لاستعادة `structuredAnswer`؛ إذا فشل تبقى كنص.
- `prefillFor` يبقى يعمل (يملأ النص فقط للأسئلة النصية). للأسئلة المنظّمة نضيف `prefillStructuredFor` بسيط (يملأ contact من بريد/جوّال/مدينة الملف، education من الملف).

### 3) لا تغييرات في قاعدة البيانات
عمود `answers` من نوع `jsonb` ويقبل أي شكل. نُسلسل القيمة المنظّمة كـ string داخل `{answer: "..."}` لتوافق البنية الحالية.

## التحقّق
- اختبار يدوي: المرور بالـ 15 سؤالاً وإكمال السيرة، التأكد من ظهور البيانات صحيحة في `/cv/builder`.
- اختبار زر "السؤال السابق" مع كل نوع جديد.
- اختبار جلسة قديمة (نص حر محفوظ) — يجب ألا تتعطّل.

## خارج النطاق
- لا تغيير على CSS/التصميم العام (نستخدم نفس `Input`/`Button`/`Card`).
- لا تغيير على منطق الاقتراحات (`askSuggestion`) — تبقى تعمل للأسئلة المنظّمة كاقتراح إرشادي فقط.
- لا تغيير على بقية المعالج (review/builder).
