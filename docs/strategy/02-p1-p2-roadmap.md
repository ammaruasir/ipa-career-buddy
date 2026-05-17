<div dir="rtl">

# خارطة طريق P1 و P2

> **المرجع:** [خطة تنفيذ P0](./01-p0-implementation.md)
> **الشرط:** بدء P1 يكون **بعد** إثبات P0 في pilot — لا قبل.

---

## الطبقة P1 — عالية الأثر

### P1.1 — مسار التعلّم وخريطة المهارات الحرارية

**الحالة الراهنة:** بذرة موجودة في `src/pages/CareerGuidance.tsx` + `supabase/functions/career-guidance/index.ts` (radar chart + 3-phase training plan + recommended courses).

**التوسعة:**

```sql
-- view لتجميع تقدّم المهارات عبر الزمن
CREATE OR REPLACE VIEW public.skill_progress_view AS
SELECT
  i.user_id,
  i.id AS interview_id,
  i.created_at,
  e.detailed_scores,
  e.disc_profile,
  e.overall_score
FROM public.interviews i
JOIN public.evaluations e ON e.interview_id = i.id
WHERE i.status = 'completed'
ORDER BY i.created_at;
```

**UI الجديدة:**
- Heatmap طولي: محور X = جلسات (آخر 10)، محور Y = 6 أبعاد، خلية ملوّنة بالدرجة
- قائمة تحقّق "الجاهزية للمقابلة النهائية":
  - ≥75 على 5 أبعاد عبر 3 جلسات
  - مقابلة assessment واحدة على الأقل بنتيجة ≥80
  - سيرة ذاتية مُقيَّمة بدرجة قسم متوسطة ≥70
- توصيات ذكية: "ركّز على بُعد X — درجاتك ثابتة عند 55"

**يُعاد استخدام:** `recharts` (موجودة)، `CareerGuidance.tsx` كأساس

**الجهد:** 7–10 أيام

### P1.2 — شخصيات مقابِل متعدّدة (Personas)

**البنية الجاهزة:** `system_settings.interviewer_voice` (أُضيف في 20260517155426) جاهز لاستضافة personas متعدّدة.

```sql
-- توسعة system_settings لـ personas متعدّدة
UPDATE public.system_settings
SET interviewer_personas = '[
  {
    "id": "friendly_hr",
    "name_ar": "نورة الفهد",
    "name_en": "Noura Al-Fahd",
    "gender": "female",
    "voice_id": "elevenlabs_voice_id_1",
    "avatar_url": "/personas/noura.png",
    "outfit": "abaya_modern",
    "tone_ar": "ودودة، مشجّعة",
    "system_prompt_modifier": "ابدأ بترحيب دافئ، استخدم تعزيز إيجابي"
  },
  {
    "id": "technical_lead",
    "name_ar": "أحمد القحطاني",
    "name_en": "Ahmed Al-Qahtani",
    "gender": "male",
    "voice_id": "elevenlabs_voice_id_2",
    "avatar_url": "/personas/ahmed.png",
    "outfit": "thobe_formal",
    "tone_ar": "تقني، دقيق، يطلب أدلّة",
    "system_prompt_modifier": "اسأل عن تفاصيل تقنية، اطلب أرقاماً، تحدّ الإجابات المبهمة"
  },
  {
    "id": "senior_government",
    "name_ar": "د. خالد العنزي",
    "name_en": "Dr. Khaled Al-Anazi",
    "gender": "male",
    "voice_id": "elevenlabs_voice_id_3",
    "avatar_url": "/personas/khaled.png",
    "outfit": "thobe_executive",
    "tone_ar": "تنفيذي، رسمي، حكومي",
    "system_prompt_modifier": "اطرح أسئلة استراتيجية، ركّز على رؤية 2030، اختبر فهم البيروقراطية"
  },
  {
    "id": "panel_pressure",
    "name_ar": "لجنة الضغط",
    "name_en": "Pressure Panel",
    "gender": "mixed",
    "voice_id": "rotating",
    "avatar_url": "/personas/panel.png",
    "outfit": "formal",
    "tone_ar": "أسئلة ملاحقة قاسية، مقاطعة محدودة",
    "system_prompt_modifier": "اطرح أسئلة follow-up صعبة، شكّك بالإجابات، لكن أوقف عند رصد ضائقة",
    "safety_gate": "psych_review_required"
  }
]'::jsonb
WHERE id = (SELECT id FROM public.system_settings LIMIT 1);
```

**⚠️ ملاحظة سلامة:** `panel_pressure` مشروط بـ `safety_gate: psych_review_required` — لا تُفعّل في UI قبل إكمال مراجعة اختصاصي نفسي.

**تعديل `AIAvatarScene.tsx`:** قبول prop `personaId` ودوران الـ avatar/voice ديناميكياً.

**الجهد:** 7–10 أيام (بدون panel_pressure) + 3–5 أيام للـ safety gates

### P1.3 — محاذاة السيرة الذاتية ↔ الإجابات

**الفكرة:** بعد المقابلة، رسالة:
> "ادّعيت في سيرتك أنك تتقن X لكن لم تذكره في أي إجابة"
> أو
> "أظهرت مهارة Y لم تذكرها — أضفها لسيرتك"

**التنفيذ:** تمرير ثانٍ بعد `evaluate-interview` يقارن `profiles.resume_skills` بنصوص الإجابات.

**الجهد:** 4–6 أيام

### P1.4 — حوكمة بنك الأسئلة وصعوبة تكيّفية

```sql
-- إضافة معايرة IRT-lite
ALTER TABLE public.question_templates
  ADD COLUMN attempt_count integer DEFAULT 0,
  ADD COLUMN avg_score numeric(5, 2);

-- view لحساب p-value تلقائياً
CREATE OR REPLACE VIEW public.question_difficulty_view AS
SELECT
  qt.id,
  qt.question_text,
  qt.difficulty,
  COUNT(r.id) AS attempts,
  AVG((r.scores->>'overall')::numeric) AS observed_difficulty,
  CASE
    WHEN AVG((r.scores->>'overall')::numeric) > 75 THEN 'easy'
    WHEN AVG((r.scores->>'overall')::numeric) > 50 THEN 'medium'
    ELSE 'hard'
  END AS calibrated_difficulty
FROM public.question_templates qt
LEFT JOIN public.responses r ON r.question_text = qt.question_text
GROUP BY qt.id, qt.question_text, qt.difficulty;
```

**الاختيار التكيّفي:** خوارزمية بسيطة في `complete-interview` — إذا نجح الطالب في صعب، نقفز؛ إن فشل في سهل، نتراجع.

**الجهد:** 5–8 أيام

### P1.5 — تفعيل المسار الإنجليزي بالكامل

استبدال `localStorage app_lang` stub بـ `react-i18next` كامل:

```bash
npm install react-i18next i18next i18next-browser-languagedetector
```

```
src/i18n/
├── index.ts
├── locales/
│   ├── ar.json
│   └── en.json
└── namespaces/
    ├── common.json
    ├── interview.json
    ├── coaching.json
    └── cv.json
```

**أيضاً:** قوالب برومبت إنجليزية + أصوات ElevenLabs إنجليزية + قوالب CV إنجليزية.

**الجهد:** 14–21 يوم (مراجعة 200+ نص)

### P1.6 — لغة التدريب بدلاً من لغة التوظيف

مراجعة شاملة لنصوص الواجهة:

| القديم | الجديد |
|--------|--------|
| مرشّح | متدرّب |
| الشواغر | المسارات الوظيفية المستهدفة |
| تم إكمال المقابلة بنجاح | أحسنت! الخطوة التالية: ... |
| فرص العمل | مسار التدريب |
| HR Dashboard | لوحة المراجعة |
| /dashboard/candidate | /dashboard/student |

**فحص لكل صفحة في `src/pages/`** + إعادة تسمية routes (مع redirects للتوافق المؤقّت).

**الجهد:** 5–7 أيام

---

## الطبقة P2 — مستقبلية (بعد التجربة التجريبية)

### P2.1 — مقابلات لجان حيّة (Panel Mock)
تعدّد شخصيات في الوقت ذاته عبر Vapi مع تبديل voice ديناميكي.

### P2.2 — غرف ممارسة بين الأقران
طالب ضد طالب (مجهول الهوية) تحت إشراف المدرّس، مع نظام تقييم متبادل.

### P2.3 — لوحة امتثال PDPL سعودية
تصدير بيانات الطالب + سجل الموافقات + إجراء حذف الذاتي، متوافق مع نظام حماية البيانات الشخصية.

### P2.4 — جسر إلى وظائف حقيقية
ربط `job_vacancies` بمنصة جدارات الحكومية لاقتراح وظائف فعلية مفتوحة.

### P2.5 — تطبيق PWA + مراجعة دون اتصال
للطلاب الذين يراجعون من الهاتف؛ تنزيل coaching وعرض دون اتصال.

### P2.6 — تكامل LMS / SCORM
التصدير إلى Moodle الخاص بـ IPA لدمج المنصة في LMS موجود.

### P2.7 — كوتشينج واعٍ بالحالة (Mood-Aware Coaching)
خطوط اتجاه للقلق والثقة عبر الجلسات (من تحليل الصوت والوجه — يحتاج موافقات نفسية وقانونية).

---

## معايير قرار "هل ننتقل من P0 إلى P1؟"

قبل البدء في P1، يجب أن:

- [ ] جميع بنود P0 منشورة ومستخدَمة لمدة شهر على الأقل
- [ ] pilot ثلاث المراحل (انظر `04-validation-plan.md`) أكمل المرحلة 2 بنجاح
- [ ] معدّل عودة الطالب الأسبوعي ≥60%
- [ ] عدد جلسات practice أعلى من جلسات assessment بـ 3:1 على الأقل (دليل أن "وضع التدريب" يُستخدَم فعلاً)
- [ ] تكلفة LLM/TTS الفعلية متّسقة مع التقديرات أو أقلّ
- [ ] لا حوادث PDPL أو شكاوى بيانات

> **انتقل إلى:** [المخاطر والقرارات المفتوحة](./03-risks-decisions.md)

</div>
