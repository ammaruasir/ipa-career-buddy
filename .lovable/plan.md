# المشكلة

في صفحة `/cv/interview`، زر **"اطلب اقتراح AI"** لا يعرض شيئاً عند الضغط. السبب موجود حرفياً في الكود (`src/pages/CVInterview.tsx` السطر 420-446):

```ts
const askSuggestion = async () => {
  // تعليق المطوّر السابق: "Workaround... Not ideal. Cleanest path: separate endpoint."
  const { data } = await supabase.functions.invoke("improve-cv-summary", {
    body: { current_summary: "", full_profile: { question: question.label_ar }, ... }
  });
  const text = uiLang === "en" ? data.en?.improved : data.ar?.improved;
  setSuggestion(text ?? null);  // ← غالباً null، فلا يظهر شيء
};
```

أي أن الزر:
1. يستدعي `improve-cv-summary` — وهي دالة مخصّصة لتحسين **ملخّص سيرة موجود**، لا لإعطاء اقتراح لسؤال.
2. يمرّر `current_summary: ""` فارغاً + يحشر السؤال داخل `full_profile.question` بشكل غير متوقّع.
3. الـ JSON Schema الصارم في الدالة يجبر النموذج على إعادة `{ar, en}` ملخّص. مع مدخل فارغ تماماً، يعيد غالباً `null` لكل منهما أو ملخّصاً عاماً بلا معنى → `setSuggestion(null)` → لا شيء يظهر للمستخدم، فقط `setSuggesting(false)`.

كما أن backend (`cv-interview-step`) يدعم `want_suggestion: true` لكن فقط داخل action `submit` (يعطي اقتراحاً للسؤال **التالي** بعد الإجابة)، ولا يوجد action لطلب اقتراح لـ **السؤال الحالي** بناءً على ما أدخله المستخدم سابقاً.

---

# الحل المقترح

## ١) إضافة action جديد `suggest` في `supabase/functions/cv-interview-step/index.ts`

- يستقبل `{ action: "suggest", session_id, language }`.
- يقرأ من الـ session: مستوى الخبرة + الوظيفة المستهدفة + القطاع + رقم الخطوة الحالية + الإجابات السابقة.
- يحدّد السؤال الحالي من `QUESTIONS[currentStep]`.
- يبني prompt مختصر لـ Lovable AI Gateway (`google/gemini-2.5-flash`) يقول:
  > "أنت مدرّب سير ذاتية. المستخدم في سؤال: {label}. خبرته: {level}، وظيفته المستهدفة: {role}. أعطه **مثالاً واحداً قصيراً** (٢-٤ أسطر) للإلهام بصياغة محترفة، باللغة المطلوبة. لا تشرح، فقط النص."
- لأسئلة `repeater` (الخبرات/التعليم/الإنجازات) يعيد عيّنة بند واحد مكتوبة بصياغة قويّة بنمط STAR.
- لأسئلة `choice` لا يستدعى أصلاً (الزر مخفي حالياً، نُبقي ذلك).
- يعيد `{ suggestion: string }`.
- يطبّق `checkRateLimit` (الموجود في `_shared/guards.ts`).

## ٢) ربط الواجهة بـ action الجديد في `src/pages/CVInterview.tsx`

- استبدال جسم `askSuggestion` ليستدعي:
  ```ts
  supabase.functions.invoke("cv-interview-step", {
    body: { action: "suggest", session_id: sessionId, language }
  })
  ```
- `setSuggestion(data.suggestion)`.
- إظهار `toast.info` ودّي إذا كانت الاستجابة فارغة (بدل toast.error صامت).
- إضافة fallback نصّي محلّي بسيط (مثال جاهز للسؤال) إذا فشل النداء، حتى لا يبقى الزر "ميتاً" أبداً.

## ٣) تنظيف الكود

- حذف التعليقات المضلّلة (`Workaround...`, `Not ideal.`) السطور 423-428.
- لا تغيير على `improve-cv-summary` (تبقى كما هي لقسم الـ Summary في CV Builder).

---

# الملفات المعدّلة

| الملف | التغيير |
|------|---------|
| `supabase/functions/cv-interview-step/index.ts` | + action `suggest` (~40 سطر) |
| `src/pages/CVInterview.tsx` | إعادة كتابة `askSuggestion` (~15 سطر) |

# المخاطر / خارج النطاق

- لن يتم تعديل قائمة الأسئلة الـ ١٥ ولا منطق الحفظ.
- لن يتم تعديل قاعدة البيانات.
- الأسئلة من نوع choice ستبقى بدون زر (سلوك مقصود).
