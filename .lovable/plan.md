## الهدف
1. تصحيح إملائي + نحوي تلقائي لكل ما يكتبه المستخدم في صانعات السيرة الثلاث.
2. التصحيح يحدث **بصمت** عند فقدان التركيز (blur). إذا كان هناك حلٌّ واحد واضح → يُطبَّق فوراً مع شارة "✓ صُحّح". إذا تعدّدت الاحتمالات → يفتح Popover صغير يعرض الخيارات + خيار "اكتب نصاً آخر".
3. تعبئة الحقول تلقائياً من بيانات تسجيل المستخدم (`profiles` + `auth.users`) في جميع الصانعات الثلاث، مع إمكانية التعديل اليدوي.

---

## الجزء ١ — التدقيق اللغوي العربي التلقائي

### Edge Function جديدة: `proofread-arabic`
- المدخل: `{ text: string, context?: "name"|"summary"|"bullet"|"general" }`
- النموذج: `google/gemini-3-flash-preview` عبر Lovable AI Gateway
- مخرجات منظَّمة (tool calling) بصيغة:
  ```json
  {
    "needs_correction": true,
    "corrections": [
      {
        "original": "مهندث",
        "options": ["مهندس"],           // option واحد → تطبيق تلقائي
        "type": "spelling",
        "explanation": "خطأ إملائي"
      },
      {
        "original": "قاد المشروع و حقق",
        "options": ["قاد المشروع وحقّق", "قاد المشروع، وحقّق"],
        "type": "grammar",
        "explanation": "وصل/فصل واو العطف"
      }
    ],
    "auto_corrected_text": "النص بعد تطبيق التصحيحات الأحادية فقط"
  }
  ```
- System prompt صارم: "صحّح الإملاء (همزات، تاء مربوطة، ألف مقصورة، لام شمسية/قمرية)، والنحو الأساسي (عطف، تنوين، تذكير/تأنيث). **لا تعيد صياغة الأسلوب**. إن كان هناك تصحيح واحد بديهي ضعه في options بعنصر واحد. إن تعدّدت الاحتمالات الصحيحة اذكرها كلها."
- Rate limit: 30/دقيقة لكل مستخدم (الحقول كثيرة).
- يحترم سياق `name` → لا يُصحّح أسماء الأعلام.

### مكوّن React جديد: `<ProofreadInput />` و `<ProofreadTextarea />`
موقع: `src/components/cv-builder/ProofreadInput.tsx`
- Wrapper حول `Input`/`Textarea` العاديين.
- يستدعي `proofread-arabic` بعد `onBlur` + debounce ٨٠٠ms (يتجاهل النصوص < ٣ أحرف أو الإنجليزية).
- إن وُجد تصحيح أحادي: يبدّل القيمة فوراً + يعرض Toast صغير "✓ صُحّح إملائياً" + شارة تختفي بعد ٣ ثوانٍ.
- إن وُجدت خيارات متعدّدة: يُلوّن المقطع بخطّ متموّج تحته (squiggly) ويفتح Popover فيه:
  - الخيارات المقترحة كأزرار
  - زر "اكتب نصاً آخر" → يُعيد التركيز بدون تغيير
  - زر "تجاهل"
- مؤشر صغير دوّار أثناء الفحص.

### تطبيقه في الصانعات الثلاث
1. **`CVBuilder.tsx`** (Stepper): استبدال جميع حقول الملخّص/الخبرات/التعليم/المهارات بـ `<ProofreadInput>` و `<ProofreadTextarea>`. الحقول الإنجليزية (email) تبقى كما هي.
2. **`CVInterview.tsx`** (محادثة ١٥ سؤال): إجابة المستخدم تمرّ على التدقيق قبل الإرسال إلى `cv-interview-step`. لو فيه تصحيحات متعدّدة → Popover قبل الإرسال.
3. **`CVChatPanel.tsx`** (دردشة /cv/review): رسائل المستخدم تمرّ على التدقيق قبل الإرسال إلى `chat-with-cv`.

---

## الجزء ٢ — تعبئة الحقول من بيانات التسجيل

### مصدر البيانات
جدول `profiles` يحوي: `full_name`, `phone`, `city`, `nationality`, `major`, `education_level`, `experience_years`, `gpa`, `date_of_birth`, `branch_location`. والإيميل من `auth.users.email`.

### Hook جديد: `useProfilePrefill()`
موقع: `src/hooks/useProfilePrefill.ts`
- يجلب `profiles` + الإيميل مرّة واحدة ويُرجِع كائناً جاهزاً للحقن:
  ```ts
  { personal_info: { full_name, email, phone, city, nationality },
    education: [{ degree, major, institution, gpa }],
    experience_years }
  ```

### `CVBuilder.tsx`
- عند تحميل draft جديد (لا يوجد سجلّ في `cv_drafts`) → تعبئة `personal_info` + إضافة سطر تعليم واحد من `profiles.major` + `education_level` + `gpa`.
- كل حقل مُعبَّأ يحمل شارة رماديّة صغيرة "من ملفك الشخصي" تختفي عند أوّل تعديل يدوي.

### `CVInterview.tsx`
- في بداية الجلسة، تُحقن الإجابات المعروفة مسبقاً في `cv_interview_sessions.answers`:
  - سؤال الاسم → `full_name`
  - سؤال التواصل → `phone`/`email`
  - سؤال التعليم → `education_level` + `major`
  - سؤال سنوات الخبرة → `experience_years`
- تُعرض كاقتراح في صندوق الإجابة قابل للتعديل، مع زر "استخدم هذا" أو "أكتب إجابة مختلفة".

### `CVReview.tsx`
- صفحة الرفع تبقى كما هي (سيرة موجودة)، لكن صندوق "الوظيفة المستهدفة" يُملأ تلقائياً من `profiles.major` كاقتراح.

---

## ملفات ستُنشأ
- `supabase/functions/proofread-arabic/index.ts`
- `src/components/cv-builder/ProofreadInput.tsx` (يصدّر Input + Textarea)
- `src/hooks/useProfilePrefill.ts`

## ملفات ستُعدَّل
- `src/pages/CVBuilder.tsx` — استبدال inputs + استخدام prefill hook
- `src/pages/CVInterview.tsx` — حقن إجابات معروفة + تدقيق قبل الإرسال
- `src/pages/CVReview.tsx` — اقتراح target_role
- `src/components/cv-builder/CVChatPanel.tsx` — تدقيق قبل الإرسال

## لا تغييرات في قاعدة البيانات
كل البيانات المطلوبة موجودة في `profiles` و `auth.users` و `cv_drafts`. لا حاجة لجداول جديدة.

## تفاصيل تقنية
- تكلفة AI: التدقيق يُستدعى مرّة لكل blur، debounced، ويُخزَّن hash للنص في `sessionStorage` لتجنّب إعادة فحص نفس النص.
- الحقول الإنجليزية (email) والأرقام (phone) لا تمرّ على التدقيق.
- في حال فشل التدقيق (شبكة/rate-limit) → يبقى النص كما هو بدون أي رسالة مزعجة (silent fail).
- التصحيح الأحادي يُسجَّل في `console.debug` فقط لتجنّب إزعاج المستخدم.
