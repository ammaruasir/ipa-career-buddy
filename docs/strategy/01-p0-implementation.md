<div dir="rtl">

# خطة تنفيذ P0 — البنود الستة الأساسية

> **المرجع:** [الرؤية الاستراتيجية](./00-vision.md)
> **ترتيب التنفيذ:** P0.1 → P0.2 → P0.6 → P0.5 → P0.3 → P0.4
> **المنصة:** Supabase + Vite/React + Lovable.dev
> **اللغة:** عربية أولاً (RTL)، مع تحضير لـ ثنائية اللغة في P1.5

## فهرس

- [P0.0 — تمهيد: حلّ enum mismatch](#p00--تمهيد-حلّ-enum-mismatch)
- [P0.1 — فصل وضع التدريب عن وضع التقييم](#p01--فصل-وضع-التدريب-عن-وضع-التقييم)
- [P0.2 — تغذية راجعة لكل إجابة + كوتشينج STAR](#p02--تغذية-راجعة-لكل-إجابة--كوتشينج-star)
- [P0.6 — طبقة المدرّس والدفعات](#p06--طبقة-المدرّس-والدفعات)
- [P0.5 — بنك أسئلة IPA](#p05--بنك-أسئلة-ipa)
- [P0.3 — مُقيِّم السيرة الذاتية](#p03--مُقيِّم-السيرة-الذاتية)
- [P0.4 — منشئ السيرة الذاتية](#p04--منشئ-السيرة-الذاتية)
- [اعتبارات RTL والترجمة العربية المشتركة](#اعتبارات-rtl-والترجمة-العربية-المشتركة)

---

## P0.0 — تمهيد: حلّ enum mismatch

**المشكلة:** القاعدة تستخدم `app_role = ('student', 'admin', 'hr')` بينما الـ frontend يستخدم `'candidate'` في `DashboardRouter.tsx` و `types.ts`. هذا تناقض يجب حلّه قبل إضافة `instructor` في P0.6.

### التغييرات

#### Migration 1: توحيد القيمة على `student`

```sql
-- supabase/migrations/<timestamp>_unify_student_role.sql
-- توحيد دور المتدرّب: استبدال 'candidate' بـ 'student' حيثما وُجد
DO $$
BEGIN
  -- لا حاجة لتعديل enum (student موجود)، لكن نحدّث أي صفوف تستخدم candidate إن وُجدت
  UPDATE public.user_roles SET role = 'student'::app_role
  WHERE role::text = 'candidate';
END $$;

-- تعليق توثيقي
COMMENT ON TYPE public.app_role IS 'أدوار المنصة: student (متدرّب)، hr (موارد بشرية)، admin (إدارة). instructor مضاف لاحقاً في P0.6.';
```

#### تحديثات الكود

- `src/integrations/supabase/types.ts`: إزالة `'candidate'` من `app_role` (سيُعاد توليده تلقائياً عبر `supabase gen types`)
- `src/pages/DashboardRouter.tsx`: تغيير الفحص من `role === 'candidate'` إلى `role === 'student'`
- `src/hooks/useAuth.tsx`: مراجعة أي مكان يفترض `candidate`
- `src/pages/Login.tsx` + `src/pages/CompleteProfile.tsx`: ضبط تعيين الدور الافتراضي

### معايير القبول

- [ ] جميع الاختبارات تمرّ بعد التحديث
- [ ] طالب جديد يسجّل، يحصل على دور `student`، ويُوجَّه إلى `/dashboard/candidate` (يمكن إعادة التسمية لاحقاً)
- [ ] لا يوجد أي مرجع لـ `'candidate'` في طبقة الدور (يبقى في URL routes حتى P1.6)

### الجهد المقدّر

**1 يوم.**

---

## P0.1 — فصل وضع التدريب عن وضع التقييم

**الفكرة:** الافتراضي = `practice` (خاص بالطالب). فقط `assessment` يصل لـ HR.

### المشكلة الحالية

`evaluate-interview/index.ts:40-46` يستعلم `job_vacancies` بناءً على `interview.job_position` — يفترض دائماً أن كل مقابلة مرتبطة بوظيفة. في وضع practice لن يكون هناك job_vacancy منطقي.

### التغييرات في القاعدة

```sql
-- supabase/migrations/<timestamp>_interview_modes.sql

-- أنواع جديدة
CREATE TYPE public.interview_mode AS ENUM ('practice', 'assessment', 'mock_final');
CREATE TYPE public.interview_visibility AS ENUM ('private', 'instructor', 'hr');

-- تعديل جدول interviews
ALTER TABLE public.interviews
  ADD COLUMN mode public.interview_mode NOT NULL DEFAULT 'practice',
  ADD COLUMN visibility public.interview_visibility NOT NULL DEFAULT 'private',
  ALTER COLUMN job_position DROP NOT NULL; -- practice لا يتطلّب وظيفة

CREATE INDEX idx_interviews_mode ON public.interviews(mode);
CREATE INDEX idx_interviews_visibility ON public.interviews(visibility);

-- تحديث RLS: HR ترى فقط visibility='hr'
DROP POLICY IF EXISTS "HR can view all interviews" ON public.interviews;

CREATE POLICY "HR can view assessment interviews"
  ON public.interviews
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'hr')
    AND visibility = 'hr'
  );

-- المدرّس يرى مقابلات طلاب دفعته (يُكتمل في P0.6)
-- مؤقّتاً نضع placeholder
CREATE POLICY "Instructor can view their cohort interviews"
  ON public.interviews
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'instructor')
    AND visibility IN ('instructor', 'hr')
    -- شرط الدفعة سيُضاف في P0.6
  );
```

### تعديل `evaluate-interview/index.ts`

**التغيير الجوهري:** البحث عن job_vacancy يصبح مشروطاً.

```typescript
// النمط المقترح (تعديل lines 40-46)
let jobContext = '';
if (interview.mode === 'assessment' && interview.job_position) {
  const { data: vacancy } = await supabase
    .from('job_vacancies')
    .select('requirements, description')
    .eq('title', interview.job_position)
    .single();
  if (vacancy) {
    jobContext = `\n\nالوظيفة المستهدفة: ${interview.job_position}\nالمتطلبات: ${JSON.stringify(vacancy.requirements)}`;
  }
} else if (interview.mode === 'practice') {
  jobContext = `\n\nهذه جلسة تدريب حرّة، ركّز على المهارات العامة والـ behavioral competencies.`;
}

// اختيار النموذج حسب المود
const modelName = interview.mode === 'practice'
  ? 'gpt-4.1-mini'  // أرخص للممارسة
  : 'gpt-4.1';      // متقدّم للتقييم

// في وضع practice: لا نُحدّث job_applications، لا نُرسل إشعار HR
if (interview.mode !== 'practice') {
  await updateJobApplicationStatus(supabase, interview);
  await notifyHR(supabase, interview);
}
```

### تعديلات إضافية

- `supabase/functions/complete-interview/index.ts`: تمرير `mode` عند الإنشاء
- `src/components/interview/InterviewTypeDialog.tsx`: إضافة خيار "وضع التدريب" مقابل "تقييم رسمي"
- `src/pages/CandidateDashboard.tsx`: زر "ممارسة جديدة" منفصل عن "مقابلة تقييم"
- `src/pages/HRDashboard.tsx` + `src/pages/HiringPipeline.tsx` + `src/pages/AdminInterviews.tsx`: تأكيد أن الاستعلامات تعمل مع RLS الجديد (يجب أن تظهر فقط assessment)

### اعتبارات RTL

- مفتاح الوضع في الواجهة: tab واحد بعنوان "ممارسة" وآخر "تقييم رسمي"، مع أيقونة 📚 و 🎯
- بادج لون مميز لكل وضع (أخضر للممارسة، أزرق للتقييم) ليكون التمييز فورياً

### معايير القبول

- [ ] طالب يبدأ جلسة practice، يُكمِلها، يرى نتائجه — HR لا تراها أبداً
- [ ] طالب يبدأ جلسة assessment تصل لـ HR وتظهر في pipeline
- [ ] تكلفة جلسة practice أقلّ من تكلفة assessment (قياس فعلي عبر usage logs)
- [ ] اختبار RLS: محاولة استعلام HR لمقابلات practice → فشل صريح

### الجهد المقدّر

**5–7 أيام.** (الجزء الصعب: منطق `evaluate-interview` لا الـ migration.)

---

## P0.2 — تغذية راجعة لكل إجابة + كوتشينج STAR

**الفكرة:** بعد كل مقابلة، الطالب يرى لكل سؤال:
- نسبة تغطية STAR (Situation / Task / Action / Result)
- إعادة كتابة محسّنة لإجابته بلغة عربية رسمية
- إجابة نموذجية ("هكذا تبدو الإجابة القوية")
- مواضع كلمات الحشو بدمج timestamps من Whisper
- مقطع صوتي/فيديو لإجابة الطالب نفسه قابل للتشغيل من النقطة

### التغييرات في القاعدة

```sql
-- supabase/migrations/<timestamp>_response_coaching.sql

ALTER TABLE public.responses
  ADD COLUMN coaching jsonb DEFAULT NULL,
  ADD COLUMN coached_at timestamptz DEFAULT NULL;

-- مخطط coaching المتوقَّع:
-- {
--   "star": {
--     "situation": { "covered": true, "evidence": "ذكر السياق...", "score": 0.8 },
--     "task": { "covered": true, "evidence": "...", "score": 0.9 },
--     "action": { "covered": false, "evidence": null, "score": 0.0 },
--     "result": { "covered": true, "evidence": "...", "score": 0.7 },
--     "overall_coverage": 0.6
--   },
--   "filler_words": [
--     { "word": "يعني", "timestamp_ms": 12500, "count_in_answer": 3 }
--   ],
--   "rewrite": "نسخة محسّنة من إجابتك بالعربية الفصحى...",
--   "exemplar": "هذه إجابة نموذجية قوية للسؤال...",
--   "model": "gpt-4.1-mini",
--   "tokens_used": 1250
-- }

COMMENT ON COLUMN public.responses.coaching IS 'تغذية راجعة تفصيلية لكل إجابة: STAR coverage + filler words + rewrite + exemplar';
```

### Edge Function جديدة: `coach-response`

```
supabase/functions/coach-response/
├── index.ts
├── prompts/
│   ├── star-analyzer-ar.ts
│   ├── rewrite-ar.ts
│   └── exemplar-ar.ts
└── deno.json
```

**البرومبت الأساسي (عربي):**

```typescript
// supabase/functions/coach-response/prompts/star-analyzer-ar.ts
export const STAR_ANALYZER_AR = `
أنت مدرّب مقابلات محترف متخصّص في القطاع الحكومي السعودي.
مهمّتك: تحليل إجابة الطالب وفق إطار STAR (الموقف، المهمّة، الإجراء، النتيجة).

لكل عنصر من STAR:
- هل ذكره الطالب بوضوح؟ (true/false)
- ما هي الجملة التي تدلّ على ذلك؟ (اقتبس حرفياً من إجابة الطالب)
- درجة الجودة من 0 إلى 1

ثم اقترح:
- نسخة معاد كتابتها بعربية فصحى رسمية مناسبة للمقابلات الحكومية (احتفظ بأسلوب الطالب لكن نظّم البنية وفق STAR)
- إجابة نموذجية مثالية تُظهر "كيف تبدو الإجابة القوية" لنفس السؤال

تجنّب:
- التعالي أو السخرية
- الترويج العدواني للذات (غير ملائم ثقافياً)
- التعميمات الإنجليزية
- الكلمات العامية إلا إن كانت في سياق إيضاحي

ركّز على نبرة: التواضع المهني، احترام التسلسل، اتساق رؤية 2030.
`;
```

**استثمار `filler_words` الموجود:**

```typescript
// قراءة filler_words من system_settings
const { data: settings } = await supabase
  .from('system_settings')
  .select('filler_words')
  .single();

const fillerWords: string[] = settings?.filler_words ?? [];

// كشف مواضع كلمات الحشو في النص + ربطها بـ timestamps من transcribe-audio
const fillerTimestamps = detectFillerWords(transcript, fillerWords, wordTimestamps);
```

### تعديلات الواجهة

#### `src/pages/InterviewResults.tsx`

إضافة Accordion لكل إجابة:

```tsx
// نمط المكوّن
<Accordion type="multiple" dir="rtl">
  {responses.map((response, idx) => (
    <AccordionItem key={response.id} value={`q-${idx}`}>
      <AccordionTrigger className="text-right">
        <div className="flex justify-between w-full">
          <span>السؤال {idx + 1}</span>
          <Badge variant={response.coaching?.star.overall_coverage > 0.7 ? 'success' : 'warning'}>
            STAR: {Math.round((response.coaching?.star.overall_coverage ?? 0) * 100)}%
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <StarMeter coverage={response.coaching?.star} />
        <ResponsePlayback
          mediaUrl={response.media_url}
          fillerTimestamps={response.coaching?.filler_words}
        />
        <RewriteComparison
          original={response.answer_text}
          rewrite={response.coaching?.rewrite}
        />
        <ExemplarAnswer text={response.coaching?.exemplar} />
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

#### مكوّنات جديدة

- `src/components/coaching/StarMeter.tsx` — 4 progress bars (S/T/A/R) مع تلوين ذكي
- `src/components/coaching/RewriteComparison.tsx` — عمودان: "إجابتك" و "نسخة محسّنة" مع highlighting للاختلافات
- `src/components/coaching/ExemplarAnswer.tsx` — collapsible مع تحذير "هذه إجابة مرجعية، ليست الوحيدة الصحيحة"
- `src/components/coaching/FillerWordsMap.tsx` — visualization لمواضع كلمات الحشو على timeline

#### إعادة استخدام `VideoPlayback.tsx`

يدعم بالفعل `startAt`/`endAt` — نمرّر `filler_words[i].timestamp_ms` لتشغيل النقطة المحدّدة.

### اعتبارات RTL

- جميع الـ progress bars تملأ من اليمين لليسار: `[&>div]:translate-x-full` في Tailwind
- نسبة STAR في الـ Badge: استخدم `Intl.NumberFormat('ar-SA').format(0.65 * 100)` للأرقام العربية
- المقارنة بين النصين: العنوان الأيمن = "إجابتك" (المرجعية)، الأيسر = "النسخة المحسّنة"
- highlighting الاختلافات: `dir="rtl"` على containers مع `unicode-bidi: plaintext` للنصوص المختلطة

### معايير القبول

- [ ] جلسة تنتهي → خلال 30 ثانية، coaching يظهر لكل سؤال
- [ ] STAR meter يعرض 4 عناصر بنسب صحيحة
- [ ] النقر على filler word → الفيديو يقفز للحظة الصحيحة
- [ ] إعادة الكتابة بعربية فصحى صحيحة (مراجعة لغوية بشرية لـ 20 عيّنة)
- [ ] الإجابة النموذجية لا تتجاوز ضعف طول إجابة الطالب (تجنّب الإغراق)

### الجهد المقدّر

**10–14 يوم.** (الجزء الصعب: ضبط البرومبت ومراجعة جودة الناتج العربي.)

---

## P0.6 — طبقة المدرّس والدفعات

**الفكرة:** المعهد ليس فرداً — هو مؤسسة. لا يمكن تشغيل برنامج تدريبي بدون مدرّسين ودفعات.

### التغييرات في القاعدة

```sql
-- supabase/migrations/<timestamp>_instructor_layer.sql

-- 1) إضافة دور المدرّس
ALTER TYPE public.app_role ADD VALUE 'instructor';

-- 2) جدول الدفعات
CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text DEFAULT NULL,
  track text NOT NULL, -- HR / IT / المالية / الإدارة العامة / ...
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  instructor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  capacity integer DEFAULT 30,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_cohorts_instructor ON public.cohorts(instructor_id);
CREATE INDEX idx_cohorts_status ON public.cohorts(status);

-- 3) جدول التسجيلات
CREATE TABLE public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE CASCADE,
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'completed')),
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE(cohort_id, student_id)
);

CREATE INDEX idx_enrollments_cohort ON public.enrollments(cohort_id);
CREATE INDEX idx_enrollments_student ON public.enrollments(student_id);

-- 4) جدول المهام
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('interview', 'cv', 'quiz', 'reflection')),
  title text NOT NULL,
  description text,
  target_track text,
  due_at timestamptz NOT NULL,
  requirements jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_assignments_cohort ON public.assignments(cohort_id);
CREATE INDEX idx_assignments_due ON public.assignments(due_at);

-- 5) جدول تعليقات المدرّس (مع timestamp في الفيديو)
CREATE TABLE public.instructor_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid REFERENCES public.interviews(id) ON DELETE CASCADE,
  response_id uuid REFERENCES public.responses(id) ON DELETE CASCADE,
  instructor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  annotation_text text NOT NULL,
  timestamp_ms integer DEFAULT NULL, -- ربط بلحظة محدّدة في الفيديو
  feedback_type text DEFAULT 'general' CHECK (feedback_type IN ('general', 'improvement', 'praise', 'concern')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_instructor_feedback_interview ON public.instructor_feedback(interview_id);

-- 6) RLS
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_feedback ENABLE ROW LEVEL SECURITY;

-- المدرّس يرى دفعاته فقط
CREATE POLICY "Instructors see own cohorts" ON public.cohorts
  FOR SELECT USING (instructor_id = auth.uid());

CREATE POLICY "Instructors manage own cohorts" ON public.cohorts
  FOR ALL USING (instructor_id = auth.uid());

-- المدرّس يرى تسجيلات دفعاته
CREATE POLICY "Instructors see enrollments in their cohorts" ON public.enrollments
  FOR SELECT USING (
    cohort_id IN (SELECT id FROM public.cohorts WHERE instructor_id = auth.uid())
  );

-- الطالب يرى تسجيلاته فقط
CREATE POLICY "Students see own enrollments" ON public.enrollments
  FOR SELECT USING (student_id = auth.uid());

-- تحديث RLS على interviews لإضافة وصول المدرّس
CREATE POLICY "Instructors see cohort student interviews" ON public.interviews
  FOR SELECT USING (
    public.has_role(auth.uid(), 'instructor')
    AND user_id IN (
      SELECT e.student_id FROM public.enrollments e
      JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid()
    )
    AND visibility IN ('instructor', 'hr')
  );

-- المدرّس يضيف تعليقاته
CREATE POLICY "Instructors create feedback for their cohort" ON public.instructor_feedback
  FOR INSERT WITH CHECK (
    instructor_id = auth.uid()
    AND interview_id IN (
      SELECT i.id FROM public.interviews i
      JOIN public.enrollments e ON e.student_id = i.user_id
      JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid()
    )
  );

-- الطالب يرى تعليقات المدرّس على مقابلاته
CREATE POLICY "Students see instructor feedback on own interviews" ON public.instructor_feedback
  FOR SELECT USING (
    interview_id IN (SELECT id FROM public.interviews WHERE user_id = auth.uid())
  );
```

### صفحات جديدة

```
src/pages/instructor/
├── InstructorDashboard.tsx       — نظرة عامة: عدد الدفعات، متوسطات الأداء، مهام المراجعة
├── CohortDetail.tsx              — قائمة الطلاب + heatmap الأداء + قائمة المهام
├── CohortCreate.tsx              — إنشاء دفعة جديدة (للأدمن)
├── AssignmentCreate.tsx          — إنشاء مهمة جديدة للدفعة
├── AssignmentView.tsx            — مراجعة مهام الطلاب + إضافة تعليقات timestamped
└── StudentProgress.tsx           — صفحة طالب: كل مقابلاته/سيره + تعليقات سابقة
```

### تعديل `DashboardRouter.tsx`

```typescript
// src/pages/DashboardRouter.tsx
useEffect(() => {
  if (!loading && role) {
    if (role === 'student') {
      navigate('/dashboard/candidate', { replace: true }); // الـ route يُعاد تسميته في P1.6
    } else if (role === 'hr') {
      navigate('/dashboard/hr', { replace: true });
    } else if (role === 'instructor') {
      navigate('/dashboard/instructor', { replace: true });
    } else if (role === 'admin') {
      navigate('/dashboard/admin', { replace: true });
    }
  }
}, [role, loading, navigate]);
```

### اعتبارات RTL

- الـ Sidebar في InstructorDashboard يكون على اليمين
- لوحة الـ heatmap: الأشد سخونة في اليمين، الأبرد في اليسار (تتبع اتجاه القراءة العربي)
- تعليقات timestamped على الفيديو: المؤشر يتحرّك من اليمين لليسار (في RTL)
- استخدم Hijri date اختياري بجانب الميلادي: `new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {...}).format(date)`

### معايير القبول

- [ ] مدرّس يُنشِئ دفعة + يضيف 5 طلاب + ينشئ مهمة "أكمل مقابلة CORE"
- [ ] الطالب يرى المهمة في dashboard ويُكمِلها
- [ ] المدرّس يفتح مقابلة الطالب، يقفز للحظة 02:35، يضيف تعليقاً "أحسنت في ذكر النتيجة الكمّية"
- [ ] الطالب يرى التعليق ويستطيع النقر للقفز للحظة
- [ ] محاولة مدرّس آخر للوصول لطالب ليس في دفعته → فشل RLS

### الجهد المقدّر

**14–18 يوم.** (الجزء الصعب: RLS متشعّب + UI لتعليقات timestamped.)

---

## P0.5 — بنك أسئلة IPA

**الفكرة:** تمديد `question_templates` ليصبح bank متخصّصاً للقطاع الحكومي السعودي.

### التغييرات في القاعدة

```sql
-- supabase/migrations/<timestamp>_ipa_question_bank.sql

ALTER TABLE public.question_templates
  ADD COLUMN track text DEFAULT NULL,
  ADD COLUMN competency text DEFAULT NULL,
  ADD COLUMN is_scenario boolean DEFAULT false,
  ADD COLUMN gov_context boolean DEFAULT false,
  ADD COLUMN model_answer_ar text DEFAULT NULL,
  ADD COLUMN model_answer_en text DEFAULT NULL,
  ADD COLUMN star_rubric jsonb DEFAULT NULL,
  ADD COLUMN status text DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'retired')),
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN review_notes text,
  ADD COLUMN p_value numeric(3, 2) DEFAULT NULL; -- لقياس صعوبة السؤال (P1.4)

-- جدول قِيَم enum للمسارات (يسهّل الإدارة)
CREATE TABLE public.tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  is_active boolean DEFAULT true
);

INSERT INTO public.tracks (code, name_ar, name_en) VALUES
  ('hr', 'الموارد البشرية', 'Human Resources'),
  ('it', 'تقنية المعلومات', 'Information Technology'),
  ('finance', 'المالية', 'Finance'),
  ('public_admin', 'الإدارة العامة', 'Public Administration'),
  ('information_mgmt', 'إدارة المعلومات', 'Information Management'),
  ('libraries', 'المكتبات', 'Libraries'),
  ('digital_transformation', 'التحوّل الرقمي', 'Digital Transformation'),
  ('citizen_services', 'خدمة المواطن', 'Citizen Services');

-- جدول الجدارات
CREATE TABLE public.competencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description text,
  is_active boolean DEFAULT true
);

INSERT INTO public.competencies (code, name_ar, name_en) VALUES
  ('decision_making', 'اتخاذ القرار', 'Decision Making'),
  ('citizen_service', 'خدمة المواطن', 'Citizen Service'),
  ('teamwork', 'العمل الجماعي', 'Teamwork'),
  ('ethics', 'الأخلاقيات', 'Ethics'),
  ('digital_skills', 'المهارات الرقمية', 'Digital Skills'),
  ('communication', 'التواصل', 'Communication'),
  ('leadership', 'القيادة', 'Leadership'),
  ('innovation', 'الابتكار', 'Innovation');

CREATE INDEX idx_questions_track ON public.question_templates(track);
CREATE INDEX idx_questions_competency ON public.question_templates(competency);
CREATE INDEX idx_questions_status ON public.question_templates(status);
```

### CMS لإدارة بنك الأسئلة

صفحة جديدة `src/pages/AdminQuestionBank.tsx`:

- جدول قابل للتصفية حسب: track / competency / status / difficulty
- Form لإنشاء/تعديل سؤال مع:
  - نص السؤال (ar/en)
  - المسار + الجدارة + الصعوبة + سياق حكومي؟
  - إجابة نموذجية (ar/en)
  - star_rubric (4 معايير لكل عنصر STAR)
- workflow: draft → review → approved
- مراجِع يضع تعليقات قبل الاعتماد

### المحتوى — track موازٍ

**هذا ليس engineering فقط.** يحتاج:

- خبراء IPA (3–5 أشخاص) لكتابة 200+ سؤال
- جدولة 6–10 أسابيع لجلسات كتابة + مراجعة
- ميزانية لكتابة الإجابات النموذجية والـ rubrics

**ينبغي بدء هذا المسار بالتوازي مع P0.1 — لا انتظار engineering.**

### اعتبارات RTL

- بنك الأسئلة UI: filters على اليمين، النتائج على اليسار
- Form الإدخال: labels على اليمين، inputs RTL، textarea بـ `dir="rtl"` للعربية + `dir="ltr"` للإنجليزية في حقول منفصلة
- جدول الأسئلة: ترتيب الأعمدة من اليمين: ID → السؤال → المسار → الجدارة → الحالة

### معايير القبول

- [ ] أدمن ينشئ سؤالاً → يطلب مراجعة → مراجِع يعتمد → يظهر للطلاب
- [ ] فلترة الأسئلة في `evaluate-interview` تختار فقط `status='approved'`
- [ ] 30 سؤالاً معتمداً على الأقل عند إطلاق pilot

### الجهد المقدّر

**Engineering: 7–10 أيام. Content: 6–10 أسابيع موازية.**

---

## P0.3 — مُقيِّم السيرة الذاتية

**الفكرة:** ترقية `analyze-resume` من استخراج إلى تقييم كامل.

### الحالة الحالية

`analyze-resume/index.ts` يستخدم Gemini-3-Flash-Preview لاستخراج بنية مهيكلة:
- technical_skills, soft_skills, certifications
- experience_years, education_level, major
- languages, summary

ويخزّنها في `profiles.resume_skills`. **هذه أساس قوي للبناء عليه.**

### التغييرات

#### 1. جدول جديد لتاريخ التحليلات

```sql
-- supabase/migrations/<timestamp>_cv_documents.sql

CREATE TABLE public.cv_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL, -- في bucket resumes/
  file_name text,
  file_size integer,
  uploaded_at timestamptz DEFAULT now(),

  -- نتائج التحليل
  extraction jsonb, -- الحقول المستخرجة (كما هي اليوم)
  section_scores jsonb, -- درجات لكل قسم (0-100)
  weaknesses jsonb, -- نقاط الضعف مع أمثلة محدّدة
  rewrites jsonb, -- إعادة كتابة عربية لكل بند ضعيف
  saudi_compliance jsonb, -- التحقّق من المعايير السعودية
  target_role text, -- الوظيفة المستهدفة (اختياري)
  alignment_score numeric(3, 2), -- درجة المحاذاة مع الوظيفة

  -- meta
  analyzed_at timestamptz DEFAULT now(),
  model_used text,
  tokens_used integer
);

CREATE INDEX idx_cv_documents_user ON public.cv_documents(user_id);
CREATE INDEX idx_cv_documents_uploaded ON public.cv_documents(uploaded_at DESC);

ALTER TABLE public.cv_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own CVs" ON public.cv_documents
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Instructors see cohort CVs" ON public.cv_documents
  FOR SELECT USING (
    public.has_role(auth.uid(), 'instructor')
    AND user_id IN (
      SELECT e.student_id FROM public.enrollments e
      JOIN public.cohorts c ON c.id = e.cohort_id
      WHERE c.instructor_id = auth.uid()
    )
  );
```

#### 2. ترقية `analyze-resume/index.ts`

تمديد schema الـ tool calling:

```typescript
const RESUME_EVALUATION_TOOL = {
  type: 'function',
  function: {
    name: 'resume_evaluation',
    description: 'تقييم شامل للسيرة الذاتية',
    parameters: {
      type: 'object',
      properties: {
        // الموجود حالياً
        extraction: { /* technical_skills, soft_skills, ... */ },

        // الجديد
        section_scores: {
          type: 'object',
          properties: {
            contact: { type: 'number', minimum: 0, maximum: 100 },
            summary: { type: 'number', minimum: 0, maximum: 100 },
            experience: { type: 'number', minimum: 0, maximum: 100 },
            education: { type: 'number', minimum: 0, maximum: 100 },
            skills: { type: 'number', minimum: 0, maximum: 100 },
            achievements: { type: 'number', minimum: 0, maximum: 100 },
            language_quality: { type: 'number', minimum: 0, maximum: 100 }
          },
          required: ['contact', 'summary', 'experience', 'education', 'skills', 'achievements', 'language_quality']
        },
        weaknesses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section: { type: 'string' },
              issue: { type: 'string', description: 'وصف المشكلة بالعربية' },
              original_text: { type: 'string', description: 'النص الأصلي من السيرة' },
              severity: { type: 'string', enum: ['minor', 'moderate', 'major'] }
            }
          }
        },
        rewrites: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              original: { type: 'string' },
              improved: { type: 'string' },
              reason: { type: 'string', description: 'سبب التحسين بالعربية' }
            }
          }
        },
        saudi_compliance: {
          type: 'object',
          properties: {
            uses_hijri_dates: { type: 'boolean' },
            address_format_correct: { type: 'boolean' },
            military_service_mentioned: { type: 'boolean' },
            jadarat_link_present: { type: 'boolean' },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  }
};
```

#### 3. صفحة جديدة `src/pages/CVReview.tsx`

```tsx
<div dir="rtl" className="container mx-auto p-6">
  <Card>
    <CardHeader>
      <CardTitle>تقييم سيرتك الذاتية</CardTitle>
    </CardHeader>
    <CardContent>
      {/* Radar chart للأقسام */}
      <SectionScoresRadar scores={cvDoc.section_scores} />

      {/* قائمة نقاط الضعف */}
      <WeaknessesList weaknesses={cvDoc.weaknesses} />

      {/* اقتراحات إعادة الكتابة (قابلة للتطبيق) */}
      <RewritesAccordion rewrites={cvDoc.rewrites} />

      {/* الامتثال السعودي */}
      <SaudiComplianceChecklist compliance={cvDoc.saudi_compliance} />

      {/* محاذاة مع وظيفة (اختياري) */}
      <JobAlignmentInput onAlign={(role) => triggerAlignment(role)} />
    </CardContent>
  </Card>
</div>
```

### Edge Function جديدة (اختيارية): `cv-job-alignment`

تحلّل التطابق بين سيرة الطالب ومتطلبات وظيفة محدّدة، تُرجع:
- درجة المحاذاة (0-100)
- مهارات متوفّرة
- مهارات ناقصة
- توصيات لتحسين السيرة لهذه الوظيفة

### اعتبارات RTL

- Radar chart: استخدم recharts `RadialBar` مع `direction="rtl"` (يحتاج تحقّق)
- قائمة نقاط الضعف: badges severity على اليسار، النص على اليمين
- مقارنة original vs improved: استخدم `<bdi>` لعزل النصوص ثنائية الاتجاه
- التواريخ الهجرية: عرضها بجانب الميلادي اختياري `1447/11/01 هـ (2026/05/17 م)`

### معايير القبول

- [ ] رفع PDF عربي → خلال 30 ثانية، تقييم كامل يظهر
- [ ] الطالب يضغط "تطبيق التحسين" على bullet → النص يُحدَّث في drafts
- [ ] محاذاة مع وظيفة مختارة → درجة + قائمة مهارات ناقصة دقيقة
- [ ] حماية: محاولة الوصول لـ CV طالب آخر → فشل RLS

### الجهد المقدّر

**8–12 يوم.**

---

## P0.4 — منشئ السيرة الذاتية

**الفكرة:** Stepper من 8 خطوات لبناء سيرة ذاتية عربية احترافية مع تصدير PDF.

### ⚠️ تحذير تقني

**Arabic RTL PDF generation معقّد.** قبل البدء، يجب spike تقني (يومان) لاختيار بين:

| الخيار | المزايا | العيوب |
|--------|---------|--------|
| `@react-pdf/renderer` + `bidi-js` | client-side، خفيف، تكامل ممتاز مع React | تعثّرات في ligatures عربية، tables RTL غير ناضجة |
| Headless Chromium (Puppeteer/Playwright في Edge Function) | جودة طباعة عالية، RTL ممتاز | ثقيل (+200MB)، أبطأ، تكلفة ops أعلى |
| WeasyPrint عبر Edge Function | جودة CSS print جيّدة | يحتاج Python runtime |

**التوصية المبدئية:** Headless Chromium مع Playwright في Edge Function منفصلة `render-cv-pdf`.

### التغييرات في القاعدة

```sql
-- supabase/migrations/<timestamp>_cv_drafts.sql

CREATE TABLE public.cv_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- بيانات السيرة (JSON منظّم)
  personal_info jsonb,    -- name, email, phone, address, hijri_dob, nationality
  summary jsonb,           -- { ar: "...", en: "..." }
  experience jsonb,        -- [{ company, position, start, end, bullets: [...] }]
  education jsonb,         -- [{ institution, degree, major, start, end, gpa }]
  skills jsonb,            -- { technical: [], soft: [], languages: [] }
  certifications jsonb,    -- [{ name, issuer, date, link }]

  -- خصائص العرض
  template text DEFAULT 'modern' CHECK (template IN ('conservative', 'modern', 'executive')),
  language text DEFAULT 'ar' CHECK (language IN ('ar', 'en', 'bilingual')),
  primary_color text DEFAULT '#1e40af',

  -- meta
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_exported_at timestamptz,
  export_count integer DEFAULT 0
);

CREATE INDEX idx_cv_drafts_user ON public.cv_drafts(user_id);

ALTER TABLE public.cv_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own drafts" ON public.cv_drafts
  FOR ALL USING (user_id = auth.uid());
```

### Edge Functions جديدة

#### `generate-cv-bullets`

توليد ذكي للنقاط بصيغة STAR-bullet:

```typescript
// supabase/functions/generate-cv-bullets/index.ts
// المدخل: { role, achievements_raw: "نص حر يصف الإنجازات" }
// المخرج: { bullets: ["• قاد فريقاً من 8 موظفين...", ...] }

const PROMPT = `
أنت كاتب سير ذاتية محترف متخصّص في القطاع الحكومي السعودي.
اقرأ الوصف الحرّ للإنجاز، وحوّله إلى 1-3 نقاط مهنية بصيغة:
- فعل قوي + ما تم + نتيجة قابلة للقياس

مثال جيّد: "قاد فريقاً من 8 موظفين لإنجاز مشروع رقمنة الأرشيف، مما خفّض زمن الاسترجاع بنسبة 65%"
مثال سيّء: "عملت على مشروع رقمنة"

اللهجة: مهنية، متواضعة، تتجنّب الترويج العدواني.
اللغة: عربية فصحى رسمية.
`;
```

#### `render-cv-pdf`

```typescript
// supabase/functions/render-cv-pdf/index.ts
import { chromium } from 'playwright'; // أو puppeteer

const QUERY: { draftId: string };

// 1. اقرأ draft من القاعدة
// 2. اعرضه عبر HTML template (RTL + Noto Naskh Arabic)
// 3. صدّره PDF عبر Playwright
// 4. ارفع إلى bucket: resumes/{user_id}/exported/{draft_id}_{ts}.pdf
// 5. أرجع signed URL
```

**خطوط مطلوبة:** Noto Naskh Arabic + IBM Plex Sans Arabic (للتنوّع البصري بين القوالب).

### صفحات جديدة

```
src/pages/CVBuilder.tsx — صفحة Stepper
src/components/cv-builder/
├── StepPersonal.tsx
├── StepSummary.tsx
├── StepExperience.tsx
├── StepEducation.tsx
├── StepSkills.tsx
├── StepCertifications.tsx
├── StepPreview.tsx
├── StepExport.tsx
├── templates/
│   ├── ConservativeTemplate.tsx  — تخطيط تقليدي 1-عمود
│   ├── ModernTemplate.tsx        — 2-عمود حديث
│   └── ExecutiveTemplate.tsx     — تنفيذي بـ header قوي
└── shared/
    ├── AIAssistant.tsx           — زر "ولّد نقاطاً بـ AI"
    └── LivePreview.tsx           — معاينة فورية
```

### اعتبارات RTL خاصّة بـ PDF

- `<html dir="rtl" lang="ar">`
- `font-family: 'Noto Naskh Arabic', serif;`
- `unicode-bidi: isolate;` على أيّ نص مختلط
- الأرقام: استخدم Arabic-Indic أو Arabic numerals بناءً على القالب (التنفيذي يستخدم Arabic numerals غالباً)
- النقاط (bullets): استخدم `•` أو `◀` (مع تجنّب أيقونات FontAwesome التي قد لا تظهر في PDF)
- التواريخ: ميلادية وهجرية معاً اختياري في personal_info
- اتجاه الـ progress bars للمهارات: من اليمين لليسار

### معايير القبول

- [ ] طالب يكمل 8 خطوات → يصدّر PDF بأقل من 5 ثوانٍ
- [ ] PDF يفتح في Adobe Reader + Foxit + macOS Preview بدون كسر RTL
- [ ] الكلمات العربية متّصلة (ligatures صحيحة)
- [ ] الأرقام تظهر بشكل صحيح في الترتيب الزمني
- [ ] حفظ كـ draft + استئناف → كل البيانات محفوظة
- [ ] 3 قوالب تعرض بشكل مختلف ومتسق

### الجهد المقدّر

**14–21 يوم** (يشمل spike + اختبار جودة عبر منصّات تشغيل مختلفة).

---

## اعتبارات RTL والترجمة العربية المشتركة

### مبادئ عامة

1. **`dir="rtl"` على عناصر الـ container لا على `<html>` العامة** — هذا يسمح بـ mixed direction مستقبلاً
2. **استخدم Tailwind's RTL utilities:**
   - `text-right` بدل `text-left` للنصوص العربية
   - `me-2` / `ms-2` (margin end/start) بدل `mr-2` / `ml-2`
   - `ps-4` / `pe-4` (padding start/end)
   - `start-0` / `end-0` بدل `left-0` / `right-0`
3. **للنصوص المختلطة:** استخدم `<bdi>` لعزل الـ direction
4. **الأرقام:** `Intl.NumberFormat('ar-SA').format(value)` للعرض، لكن الكود الداخلي بـ Arabic numerals
5. **التواريخ:**
   - عرض مزدوج هجري/ميلادي حيث يهمّ
   - `Intl.DateTimeFormat('ar-SA-u-ca-islamic', { year: 'numeric', month: 'long', day: 'numeric' })`
6. **الأيقونات الاتجاهية:** chevrons، arrows، breadcrumbs — كلها تنعكس في RTL تلقائياً إذا استخدمنا `transform: scaleX(-1)` المشروط

### الخطوط الموصى بها

```css
/* في tailwind.config.ts */
fontFamily: {
  arabic: ['Noto Naskh Arabic', 'Tajawal', 'serif'],
  arabic_ui: ['IBM Plex Sans Arabic', 'Tajawal', 'sans-serif'],
  arabic_display: ['Cairo', 'sans-serif']
}
```

### تحضير لـ ثنائية اللغة (P1.5)

حتى في P0، احرص على:
- كل حقل نصّي في القاعدة له `_ar` و`_en` (مع `_en` nullable مبدئياً)
- البرومبتس مخزّنة في ملفات منفصلة لكل لغة، لا inline
- لا hardcoded Arabic strings في components — استخدم thin wrapper الآن للتحضير لـ react-i18next لاحقاً

### مراجعة لغوية بشرية

كل نص موجّه للطالب (coaching، rewrites، exemplars، error messages) يجب أن يمرّ على مراجعة لغوية بشرية قبل النشر. خطّط لـ:
- 2 ساعة مراجعة أسبوعياً مع مدقّق لغوي عربي
- glossary موحّد للمصطلحات (في `docs/strategy/glossary.md` — لاحقاً)

---

## ملخّص الجهد الإجمالي لـ P0

| البند | الجهد | اعتمادات |
|------|------|----------|
| P0.0 | 1 يوم | لا شيء |
| P0.1 | 5–7 أيام | P0.0 |
| P0.2 | 10–14 يوم | P0.1 |
| P0.6 | 14–18 يوم | P0.0 + P0.1 |
| P0.5 (eng) | 7–10 أيام | لا شيء (بالتوازي) |
| P0.5 (content) | 6–10 أسابيع | بدء فوري بخبراء IPA |
| P0.3 | 8–12 يوم | لا شيء (بالتوازي) |
| P0.4 | 14–21 يوم | spike 2 أيام أولاً |

**المجموع التقديري لـ Engineering:** 8–14 أسبوع (40–70 يوم عمل) إذا كان مطوّر واحد. مع فريق 2–3 مطوّرين بالتوازي: 5–8 أسابيع.

**المسار الحرج:** P0.0 → P0.1 → P0.2 → P0.6 (sequential)
**بالتوازي:** P0.5 content + P0.3 + P0.4

> **انتقل إلى:** [خارطة طريق P1 و P2](./02-p1-p2-roadmap.md)

</div>
