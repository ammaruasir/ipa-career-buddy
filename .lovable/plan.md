# خطة Lovable: نشر "وضع العرض التفاعلي" (Demo Mode — AI Walkthrough)

## السياق

تمّت إضافة ميزة "جولة AI تفاعلية" كاملة (٧ مراحل) — مرشدة عربية خليجية ("لينا") تتنقّل في المنصّة كاملةً، تشرح، وتجيب على أسئلة الزوّار. تشمل ٣٩ خطوة عبر ٨ فصول، وتغطّي مسار المرشّح + الإدارة + الـ HR + المدرّب. كل الكود جاهز ومُختبر typecheck + build. المطلوب من Lovable: تفعيل المكوّنات الخلفية بعد الـ push.

---

## ١) نشر الدوال السحابية الجديدة

```
supabase--deploy_edge_functions([
  "demo-chat",
  "demo-candidate-bot",
  "demo-transcribe",
  "demo-session"
])
```

كلها auth-free بتصميم (لزوّار `/demo` غير المسجّلين)، مع IP rate-limit مدمج عبر `_shared/demo-guards.ts` (يعيد استخدام `check_rate_limit` RPC الموجود). الحدود:

| الدالة | السقف لكل IP في الساعة |
|---|---|
| `demo-chat` | ٣٠ |
| `demo-candidate-bot` | ٦٠ |
| `demo-transcribe` | ٣٠ |
| `demo-session` | ١٢ |

**المتغيّرات المطلوبة** (Lovable لديه الأساسيات أصلًا):
- `OPENAI_API_KEY` — موجود
- `LOVABLE_API_KEY` — موجود (للـ STT عبر Gemini)
- `ELEVENLABS_API_KEY` — موجود
- `SUPABASE_SERVICE_ROLE_KEY` — موجود (للـ rate-limit RPC)
- `DEMO_CANDIDATE_PASSWORD`, `DEMO_ADMIN_PASSWORD`, `DEMO_HR_PASSWORD`, `DEMO_INSTRUCTOR_PASSWORD` — اختياري (افتراضات آمنة في الكود)

## ٢) تطبيق الـ migration

```
supabase--apply_migration("20260518160000_demo_mode_scaffold")
```

تضيف:
- عمود `is_demo boolean DEFAULT false` على ٩ جداول (profiles, interviews, responses, evaluations, cv_drafts, cohorts, enrollments, job_vacancies, question_templates).
- دالة `public.is_demo_account(uuid)` — تتعرّف على حسابات `demo-*@ipa-training.sa`.
- سياسات RLS متناظرة (RESTRICTIVE) على الجداول التسعة: الحسابات التجريبية تشاهد صفوف is_demo=true **فقط**، والمستخدمون العاديون لا يشاهدونها **أبدًا**.

**لن تتأثّر بيانات الإنتاج** — العمود الافتراضي false، والسياسات RESTRICTIVE تُضاف فوق السياسات الموجودة (AND).

## ٣) بذر بيانات العرض (Seed)

تشغيل سكربت البذر بعد نجاح الـ migration:

```
node scripts/seed-demo-data.ts
# يحتاج SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY فقط
```

ينشئ ٥ حسابات بإدارة admin API:
- `demo-candidate@ipa-training.sa` (سارة الراشد)
- `demo-candidate2@ipa-training.sa` (خالد المطيري — للمقارنة في `/dashboard/hr/compare`)
- `demo-admin@ipa-training.sa` + دور `admin`
- `demo-hr@ipa-training.sa` + دور `hr`
- `demo-instructor@ipa-training.sa` + دور `instructor`

كذلك يبذر: وظيفة "مهندسة واجهات أمامية تجريبية"، ٥ أسئلة في بنك الأسئلة، دفعة تجريبية + تسجيلات. كلها بـ `is_demo=true`.

**الـ idempotent**: التشغيل المتكرّر يحدّث ولا يكرّر.

## ٤) التحقّق

بعد النشر + الـ migration + الـ seed:

```
node scripts/demo-rls-audit.ts        # يتحقّق أن العزل بين حسابات الديمو وبيانات الإنتاج محكم
node scripts/demo-latency-profile.ts  # يقيس latency الـ Q&A — هدف < ٤s
```

ثم اختبار يدوي:
1. فتح `/demo` في تبويب incognito.
2. تفعيل صندوق "السماح بالميكروفون" (اختياري).
3. الضغط على "ابدأ الجولة" — تبدأ "لينا" بالكلام بصوت عربي.
4. التنقّل التلقائي بين الصفحات يعمل، الـ spotlight يلتقط العنصر المناسب.
5. الضغط على الميكروفون أثناء الكلام → الصوت يتوقّف، التسجيل يبدأ. تحرير الزر → STT → جواب من لينا.

## ٥) (اختياري — تحسين تكلفة) الـ TTS Pre-cache

بعد تجميد السكربت، تشغيل:

```
node scripts/precache-demo-tts.ts
# ينشئ public/demo-audio/{step.id}.mp3 لكل خطوة ثابتة
```

يخفّض التكلفة التشغيلية من ~$6.55 إلى ~$2.50 لكل جلسة كاملة (~٧٠٪ توفير على TTS). الـ frontend يفحص `/demo-audio/{step.id}.mp3` أولًا ثم يسقط على API عند الفقدان.

## ٦) Phase B.5 — أصوات خليجية (خارجي)

`src/demo/voices.ts` يحتوي خطّة procurement كاملة. حاليًا ٣ الأصوات تستخدم voice ID موحّد كـ fallback، فيشتغل الديمو لكن بنفس الصوت لجميع الشخصيات. لتمييز سارة عن لينا، يحتاج فريق المنتج تسجيل عيّنتين (٣–٥ دقائق ذكر + أنثى بلهجة خليجية) ورفعها عبر ElevenLabs Pro Voice Cloning، ثم تحديث المعرّفات في `voices.ts`.

---

## الملفات الجديدة

**Frontend (`src/`):**
- `pages/Demo.tsx`
- `contexts/DemoTourContext.tsx`
- `hooks/useDemoVoice.ts`, `useDemoCandidate.ts`, `useDemoInterview.ts`
- `components/demo/` (٥ مكوّنات)
- `demo/` (script + persona + types + voices + feature-spec)

**Backend (`supabase/`):**
- `functions/demo-chat/`
- `functions/demo-candidate-bot/`
- `functions/demo-transcribe/`
- `functions/demo-session/`
- `functions/_shared/demo-guards.ts`
- `migrations/20260518160000_demo_mode_scaffold.sql`

**Scripts (`scripts/`):**
- `seed-demo-data.ts` — بذر الحسابات والبيانات
- `precache-demo-tts.ts` — تخزين MP3 ثابت
- `demo-latency-profile.ts` — قياس الأداء
- `demo-rls-audit.ts` — تحقّق العزل

**التعديلات الموجودة:**
- `src/App.tsx` — DemoTourProvider + DemoOverlay + مسار `/demo`
- `src/pages/Index.tsx` — زر CTA عائم (يمين الشاشة تحت الـ header)
