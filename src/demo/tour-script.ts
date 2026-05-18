import type { TourStep } from "./types";

// Master demo script for IPA Career Buddy.
// Round 1 (39 steps in 8 acts) → Round 4 (~62 steps in 11 acts).
// New in round 4:
//   • PDPL banner step (Act 2.5)
//   • Honest bilingual narration (language-toggle step REMOVED — no UI exists)
//   • CV creation flow: interview wizard runs interactively (Act 3)
//   • CV Builder interactive: Job Align dialog + Export
//   • CV Review uses ?demo=preloaded (no upload needed) + CV Chat panel
//   • Cover Letter generation from same draft
//   • AI-vs-AI live practice interview (Act 4) → real /interview/{id}/results
//   • AI-vs-AI live assessment interview (Act 5)
//   • STAR coaching highlight
//   • Cohort detail + timestamped feedback (Act 7)
//   • Honest live-proctor narration

export const tourScript: TourStep[] = [
  // ──────────────────────────── ACT 1 — HOOK ────────────────────────────
  {
    id: "act1-intro",
    act: "Act 1 — Hook",
    narration:
      "السلام عليكم. أنا عبدالله، مرشدك في منصّة معهد الإدارة العامة. خلال الدقائق القادمة، راح أعرّفك على المنصّة كاملة — من التسجيل إلى المقابلة الرسمية، وراح تشوف الـ AI يشتغل فعلياً، مو فقط شرح نظري. تقدر تقاطعني في أي وقت بالميكروفون أو بالكتابة.",
    durationEstimateMs: 18_000,
  },
  {
    id: "act1-landing",
    act: "Act 1 — Hook",
    route: "/",
    narration:
      "هذي الصفحة الرئيسية. المشكلة: المقابلات مرعبة، والتوظيف بطيء. نقدّم ثلاث رحلات تعليمية: تدريب، سيرة ذاتية، ومسار مؤسسي للمدرّبين.",
    spotlight: { selector: "h1", label: "نظرة عامة" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act1-features",
    act: "Act 1 — Hook",
    route: "/features",
    narration:
      "صفحة الميزات الكاملة. ستّ ركائز: التدريب الآمن، التقييم الرسمي، منشئ السيرة، محادثة بناء السيرة، تقييم السيرة، ولوحة المدرّب.",
    spotlight: { selector: "h1", label: "الميزات" },
    durationEstimateMs: 13_000,
  },

  // ──────────────────────────── ACT 2 — SIGNUP ──────────────────────────
  {
    id: "act2-signup-form",
    act: "Act 2 — Signup",
    route: "/login?tab=signup",
    narration:
      "أول خطوة لأي مستخدم: التسجيل. عادةً تكتب بريدك وكلمة سرّ. خلّيني أعبّيها كمثال — لكن مو راح أضغط زر التسجيل، عشان نكمّل بحساب تجريبي جاهز.",
    spotlight: { selector: "form", label: "نموذج التسجيل" },
    action: {
      kind: "type",
      selector: "input[type='email']",
      text: "demo.candidate@ipa.sa",
      speedMs: 40,
    },
    durationEstimateMs: 15_000,
  },
  {
    id: "act2-reset-password",
    act: "Act 2 — Signup",
    route: "/reset-password",
    narration:
      "إذا نسيت كلمة المرور، تقدر تستعيدها من هنا. تكتب بريدك، يوصلك رابط، تعيّن كلمة جديدة. بسيط وآمن.",
    spotlight: { selector: "input[type='email']", label: "استعادة كلمة المرور" },
    durationEstimateMs: 10_000,
  },
  {
    id: "act2-session-swap-candidate",
    act: "Act 2 — Signup",
    narration:
      "حسناً، خلّينا نتجاوز خطوة التحقّق ونكمّل وكأنّك سجّلت دخولك للتوّ. راح أحوّل الجلسة الآن إلى حساب تجريبي جاهز…",
    action: { kind: "swap-session", role: "candidate" },
    durationEstimateMs: 8_000,
  },
  {
    id: "act2-complete-profile",
    act: "Act 2 — Signup",
    route: "/complete-profile",
    narration:
      "أول مرّة تسجّل، تشوف هذي الصفحة — إكمال الملف الشخصي. الاسم، التخصّص، سنوات الخبرة، اللغة، والمدينة. تساعد الـ AI يخصّص لك المقابلات.",
    spotlight: { selector: "h1, h2", label: "إكمال الملف" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act2-first-dashboard",
    act: "Act 2 — Signup",
    route: "/dashboard/candidate",
    narration:
      "وأخيراً، لوحتك الشخصية. هنا تشوف تقدّمك، سيرتك، آخر المقابلات، وفرص الوظائف.",
    spotlight: { selector: "h1, h2", label: "لوحة المرشّح" },
    durationEstimateMs: 9_000,
  },

  // ─────────────────────────── ACT 2.5 — NAVIGATION ─────────────────────
  {
    id: "act2.5-nav-walkthrough",
    act: "Act 2.5 — Navigation",
    narration:
      "خلّيني أعرّفك على شريط التنقّل العلوي. هنا تنتقل بين الميزات الرئيسية: لوحة التحكّم، السيرة، المقابلات، الوظائف، التوجيه المهني. وفي اليسار قائمة حسابك وتسجيل الخروج.",
    spotlight: { selector: "header, nav", label: "شريط التنقّل" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act2.5-pdpl-banner",
    act: "Act 2.5 — Navigation",
    narration:
      "لاحظ هذي النافذة المنبثقة — موافقة حماية البيانات السعودية. كل ميزة AI تتطلّب موافقتك الصريحة قبل إرسال أي بيانات لأي مزوّد. هذا ليس مجرّد checkbox — هو commitment للخصوصية، خصوصاً للقطاع الحكومي.",
    spotlight: { selector: "[role='dialog'], [data-tour='consent-banner']", label: "موافقات PDPL" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act2.5-language-honest",
    act: "Act 2.5 — Navigation",
    narration:
      "اللغة العربية هي اللغة الأساسية للواجهة كاملة. أما ميزات الـ AI — منشئ السيرة، رسالة التقديم، وحوار السيرة — فتدعم إخراج ثنائي اللغة عربي وإنجليزي للمتقدّمين للوظائف الدولية.",
    spotlight: { selector: "header, nav", label: "لغة الواجهة عربية" },
    durationEstimateMs: 13_000,
  },

  // ────────────────────────────── ACT 3 — CV ────────────────────────────
  {
    id: "act3-cv-hub",
    act: "Act 3 — CV",
    route: "/cv",
    narration:
      "حان وقت بناء السيرة الذاتية. ثلاث طرق: منشئ يدوي بسبع خطوات، محادثة موجَّهة، أو رفع سيرة موجودة للتقييم. وفي الأعلى ثلاثة قوالب بصرية جاهزة.",
    spotlight: { selector: "main", label: "ثلاث طرق + قوالب" },
    durationEstimateMs: 13_000,
  },
  // CV Interview — actually run a couple of steps interactively
  {
    id: "act3-cv-interview-open",
    act: "Act 3 — CV",
    route: "/cv/interview",
    narration:
      "الطريقة الأولى: نبني السيرة من الصفر بمحادثة موجَّهة. خمسة عشر سؤال، الـ AI يحوّل إجاباتك إلى مسوّدة احترافية. شوف معاي…",
    spotlight: { selector: "main", label: "محادثة السيرة" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act3-cv-interview-start",
    act: "Act 3 — CV",
    narration: "أضغط زر البدء.",
    action: { kind: "click", selector: "[data-tour='cv-interview-start']", delayMs: 400 },
    durationEstimateMs: 5_000,
  },
  {
    id: "act3-cv-interview-answer",
    act: "Act 3 — CV",
    narration:
      "أوّل سؤال عادةً عن الاسم أو الدور المستهدف. سارة تكتب إجابتها — وأي سؤال لاحقاً يقدر الـ AI يقترح صياغة جاهزة بضغطة زر.",
    action: {
      kind: "type",
      selector: "[data-tour='cv-interview-answer']",
      text: "سارة الراشد، مهندسة واجهات أمامية، 3 سنوات خبرة، أستهدف دور Senior Frontend في القطاع الحكومي.",
      speedMs: 25,
    },
    durationEstimateMs: 11_000,
  },
  {
    id: "act3-cv-interview-next",
    act: "Act 3 — CV",
    narration: "نضغط التالي وننتقل للسؤال اللي بعده.",
    action: { kind: "click", selector: "[data-tour='cv-interview-next']", delayMs: 400 },
    durationEstimateMs: 6_000,
  },
  {
    id: "act3-cv-builder",
    act: "Act 3 — CV",
    route: "/cv/builder",
    narration:
      "الطريقة الثانية: المنشئ اليدوي بسبع خطوات. لاحظ المؤشرات في الـ header: ATS Score حيّ، خيارات القالب واللغة، زر طابق-مع-وظيفة، وزر رسالة التقديم. التواريخ تدعم هجري وميلادي، والأقسام قابلة للسحب لإعادة الترتيب.",
    spotlight: { selector: "main", label: "منشئ السيرة" },
    durationEstimateMs: 16_000,
  },
  {
    id: "act3-cv-builder-job-align",
    act: "Act 3 — CV",
    narration: "ميزة فريدة: طابق سيرتك مع وصف وظيفة محدّد. أضغط الزر…",
    action: { kind: "click", selector: "[data-tour='job-align']", delayMs: 500 },
    durationEstimateMs: 6_000,
  },
  {
    id: "act3-cv-builder-job-align-paste",
    act: "Act 3 — CV",
    narration:
      "ألصق وصف الوظيفة المستهدفة — يطلع لك Match Score، كلمات مفتاحية متطابقة ومفقودة، واقتراحات لإعادة كتابة bullets بكلمات الوصف نفسها.",
    action: {
      kind: "type",
      selector: "[data-tour='job-align-jd']",
      text: "نبحث عن مهندس واجهات أمامية Senior بخبرة 4+ سنوات في React, TypeScript, Next.js. يقود تحسين الأداء وله خبرة في design systems وتجربة المستخدم. مطلوب فهم احتياجات القطاع الحكومي.",
      speedMs: 14,
    },
    durationEstimateMs: 14_000,
  },
  {
    id: "act3-cv-builder-job-align-analyze",
    act: "Act 3 — CV",
    narration: "أضغط حلّل التوافق وأنتظر النتيجة.",
    action: { kind: "click", selector: "[data-tour='job-align-analyze']", delayMs: 400 },
    durationEstimateMs: 9_000,
  },
  {
    id: "act3-cv-builder-export",
    act: "Act 3 — CV",
    route: "/cv/builder",
    narration:
      "وأخيراً، تصدير PDF فعلي — ليس placeholder. الـ PDF يحترم القالب المختار، RTL سليم، خطوط عربية احترافية، ودعم ثنائي للغة في ملفّ واحد للمتقدّمين للوظائف الدولية.",
    spotlight: { selector: "[data-tour='export-pdf']", label: "تصدير PDF" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act3-cv-review",
    act: "Act 3 — CV",
    route: "/cv/review?demo=preloaded",
    narration:
      "الطريقة الثالثة: تقييم سيرة موجودة. هنا نموذج جاهز للعرض — رسم radar لجودة الأقسام، نقاط ضعف، إعادات كتابة محسّنة بتبريرات، وفحص امتثال سعودي للهجري وجدارات.",
    spotlight: { selector: "main", label: "تقييم سيرة" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act3-cv-chat-input",
    act: "Act 3 — CV",
    narration:
      "وأهم ميزة: تقدر تتحدّث مع سيرتك. اسأل لماذا قسم خبرتي ضعيف، يجيك جواب مدعوم بأمثلة محدّدة من نصّ سيرتك. سارة تجرّب الحين.",
    action: {
      kind: "type",
      selector: "[data-tour='cv-chat-input']",
      text: "لماذا قسم الإنجازات حصل على درجة منخفضة؟ وكيف أحسّنها؟",
      speedMs: 22,
    },
    durationEstimateMs: 12_000,
  },
  {
    id: "act3-cv-chat-send",
    act: "Act 3 — CV",
    narration: "أرسل السؤال.",
    action: { kind: "click", selector: "[data-tour='cv-chat-send']", delayMs: 400 },
    durationEstimateMs: 7_000,
  },
  {
    id: "act3-cover-letter",
    act: "Act 3 — CV",
    route: "/cv/cover-letter/demo",
    narration:
      "ومن نفس مسوّدة السيرة، نولّد رسالة تقديم بضغطة زر. ٣-٤ فقرات احترافية. ألصق الـ JD لتحصل على رسالة مخصّصة لتلك الوظيفة. ثنائية اللغة مع نسخة-إلى-حافظة بضغطة.",
    spotlight: { selector: "main", label: "رسالة التقديم" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act3-career-guidance",
    act: "Act 3 — CV",
    route: "/career-guidance",
    narration:
      "بعد ما تكتمل سيرتك، تأتي صفحة التوجيه المهني. الـ AI يقترح مسارات وظيفية، يحلّل فجوات مهاراتك، ويعطيك موارد تعليمية.",
    spotlight: { selector: "main", label: "التوجيه المهني" },
    durationEstimateMs: 12_000,
  },

  // ─────────────────────────── ACT 4 — PRACTICE ─────────────────────────
  {
    id: "act4-dashboard-revisit",
    act: "Act 4 — Practice",
    route: "/dashboard/candidate",
    narration:
      "نرجع للوحة المرشّح. سيرة سارة الآن جاهزة، والإحصائيات بدأت تتعبّى. الخطوة التالية: التدريب.",
    spotlight: { selector: "main", label: "تقدّم المرشّح" },
    durationEstimateMs: 10_000,
  },
  {
    id: "act4-practice-voice",
    act: "Act 4 — Practice",
    route: "/interview/voice?practice=true&question_count=2",
    narration:
      "مقابلة تدريبية. الميزة الكبيرة: ما تنحفظ في ملف المرشّح ولا تظهر للـ HR. تخطئ، تتعلّم، تكرّر — بأمان.",
    spotlight: { selector: "main", label: "وضع التدريب" },
    durationEstimateMs: 12_000,
  },
  // —— AI vs AI live cameo ——
  {
    id: "act4-ai-vs-ai-intro",
    act: "Act 4 — Practice",
    narration:
      "بس قبل ما نشرح النتائج — خلّونا نشغّل مقابلة حقيقية. المحاوِرة الـ AI نورة راح تجاوبها مرشّحة AI ثانية اسمها سارة. تشوف الـ flow كامل، صوت بصوت، وبنهاية الجلسة تطلع نتائج فعلية مو محاكاة.",
    durationEstimateMs: 13_000,
  },
  {
    id: "act4-ai-vs-ai-pause-narrator",
    act: "Act 4 — Practice",
    narration: "أصمت لحظة عشان نسمع نورة.",
    action: { kind: "pause-voice" },
    durationEstimateMs: 4_000,
  },
  {
    id: "act4-ai-vs-ai-start",
    act: "Act 4 — Practice",
    narration: "",
    action: { kind: "start-live-interview", mode: "practice", questionCount: 2 },
    durationEstimateMs: 15_000,
  },
  {
    id: "act4-ai-vs-ai-q1",
    act: "Act 4 — Practice",
    narration: "",
    action: {
      kind: "ai-vs-ai-turn",
      questionIndex: 1,
      totalQuestions: 2,
      context: "practice_interview",
    },
    durationEstimateMs: 28_000,
  },
  {
    id: "act4-ai-vs-ai-q2",
    act: "Act 4 — Practice",
    narration: "",
    action: {
      kind: "ai-vs-ai-turn",
      questionIndex: 2,
      totalQuestions: 2,
      context: "practice_interview",
    },
    durationEstimateMs: 28_000,
  },
  {
    id: "act4-ai-vs-ai-end",
    act: "Act 4 — Practice",
    narration: "",
    action: { kind: "end-live-interview" },
    durationEstimateMs: 6_000,
  },
  {
    id: "act4-ai-vs-ai-resume-narrator",
    act: "Act 4 — Practice",
    narration: "كملت المقابلة. الـ pipeline حقيقي خلَّصها وحفظ النتائج. خلّونا نشوف.",
    action: { kind: "resume-voice" },
    durationEstimateMs: 8_000,
  },
  {
    id: "act4-text-mode",
    act: "Act 4 — Practice",
    route: "/interview/text",
    narration: "نفس المقابلة لكن نصّياً — للحالات اللي ما يفضّل فيها المستخدم الصوت.",
    spotlight: { selector: "main", label: "وضع نصّي" },
    durationEstimateMs: 8_000,
  },
  {
    id: "act4-video-mode",
    act: "Act 4 — Practice",
    route: "/interview/video",
    narration: "وهذي مقابلة الفيديو — تُستخدم في التقييم الرسمي مع Proctor للتأكّد من هوية المرشّح.",
    spotlight: { selector: "main", label: "وضع الفيديو" },
    durationEstimateMs: 9_000,
  },
  {
    id: "act4-practice-results",
    act: "Act 4 — Practice",
    route: (ctx) =>
      ctx.lastInterviewId
        ? `/interview/${ctx.lastInterviewId}/results`
        : "/dashboard/candidate",
    narration:
      "هذي نتائج المقابلة اللي للتوّ شفناها مباشرة — تقييم DISC، STAR coaching لكل إجابة، رسم radar للمهارات، وإعادات كتابة محسَّنة. الهدف: تتعلّم 'لماذا' — لا فقط 'كم درجة'.",
    spotlight: { selector: "main", label: "نتائج التدريب" },
    durationEstimateMs: 16_000,
  },
  {
    id: "act4-star-coaching",
    act: "Act 4 — Practice",
    narration:
      "هذا الـ STAR Coaching هو 'لماذا' المنصّة. لكل إجابة: تقييم منفصل للموقف والمهمّة والإجراء والنتيجة، نسختك مقابل نسخة محسَّنة، وكلمات الحشو مرصودة. تتعلّم لماذا تخسر النقاط — مو فقط أنك خسرتها.",
    spotlight: { selector: "main", label: "تغذية STAR" },
    durationEstimateMs: 14_000,
  },

  // ───────────────────────── ACT 4.5 — SETTINGS ────────────────────────
  {
    id: "act4.5-profile-settings",
    act: "Act 4.5 — Settings",
    route: "/settings/profile",
    narration: "إعدادات الملف الشخصي. تقدر تحدّث اسمك، صورتك، نبذة عنك، لغتك المفضّلة، وكلمة السرّ.",
    spotlight: { selector: "main", label: "إعدادات الملف" },
    durationEstimateMs: 9_000,
  },
  {
    id: "act4.5-interview-settings",
    act: "Act 4.5 — Settings",
    route: "/settings/interview",
    narration: "إعدادات المقابلة: الوضع الافتراضي، اللغة، صوت المحاوِر، ومستوى الصعوبة.",
    spotlight: { selector: "main", label: "إعدادات المقابلة" },
    durationEstimateMs: 8_000,
  },

  // ───────────────────────── ACT 5 — ASSESSMENT ────────────────────────
  {
    id: "act5-jobs",
    act: "Act 5 — Assessment",
    route: "/jobs",
    narration:
      "صفحة الوظائف. هنا تتصفّح الوظائف المتاحة وتقدّم. خلّيني أختار 'مهندسة واجهات أمامية' تناسب سارة.",
    spotlight: { selector: "main", label: "الوظائف" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act5-assessment-run",
    act: "Act 5 — Assessment",
    route: "/interview/voice?job=demo&question_count=2",
    narration:
      "المقابلة التقييمية تختلف عن التدريبية: تتطلّب موافقة صريحة، فحص ميكروفون، ثم تنطلق في وضع مُسجَّل بدرجات. نشغّل مرّة ثانية AI ضد AI لكن في وضع التقييم الرسمي.",
    spotlight: { selector: "main", label: "المقابلة الرسمية" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act5-ai-vs-ai-pause",
    act: "Act 5 — Assessment",
    narration: "",
    action: { kind: "pause-voice" },
    durationEstimateMs: 3_500,
  },
  {
    id: "act5-ai-vs-ai-start",
    act: "Act 5 — Assessment",
    narration: "",
    action: { kind: "start-live-interview", mode: "assessment", questionCount: 2 },
    durationEstimateMs: 15_000,
  },
  {
    id: "act5-ai-vs-ai-q1",
    act: "Act 5 — Assessment",
    narration: "",
    action: {
      kind: "ai-vs-ai-turn",
      questionIndex: 1,
      totalQuestions: 2,
      context: "assessment_interview",
    },
    durationEstimateMs: 28_000,
  },
  {
    id: "act5-ai-vs-ai-q2",
    act: "Act 5 — Assessment",
    narration: "",
    action: {
      kind: "ai-vs-ai-turn",
      questionIndex: 2,
      totalQuestions: 2,
      context: "assessment_interview",
    },
    durationEstimateMs: 28_000,
  },
  {
    id: "act5-ai-vs-ai-end",
    act: "Act 5 — Assessment",
    narration: "",
    action: { kind: "end-live-interview" },
    durationEstimateMs: 6_000,
  },
  {
    id: "act5-ai-vs-ai-resume",
    act: "Act 5 — Assessment",
    narration:
      "كملت الجلسة الرسمية. النتيجة المرجَّحة جاهزة للـ HR — تقني ٤٠٪، تواصل ٣٠٪، ملاءمة ثقافية ٣٠٪.",
    action: { kind: "resume-voice" },
    durationEstimateMs: 9_000,
  },
  {
    id: "act5-assessment-results",
    act: "Act 5 — Assessment",
    route: (ctx) =>
      ctx.lastInterviewId
        ? `/interview/${ctx.lastInterviewId}/results`
        : "/dashboard/candidate",
    narration:
      "نتائج المقابلة الرسمية تشبه التدريبية لكن مع تقييم مرجَّح بدرجة نهائية، DISC، STAR coaching، ورسم radar — جاهز للـ HR والمسؤول للمراجعة.",
    spotlight: { selector: "main", label: "النتيجة المرجَّحة" },
    durationEstimateMs: 14_000,
  },

  // ──────────────────────────── ACT 6 — ADMIN ──────────────────────────
  {
    id: "act6-session-swap-admin",
    act: "Act 6 — Admin",
    narration:
      "حسناً، الآن لنرى ماذا يرى المسؤول خلال هذه العملية. راح أبدّل الجلسة إلى حساب مسؤول تجريبي…",
    action: { kind: "swap-session", role: "admin" },
    durationEstimateMs: 8_000,
  },
  {
    id: "act6-admin-dashboard",
    act: "Act 6 — Admin",
    route: "/dashboard/admin",
    narration:
      "لوحة المسؤول. قائمة المقابلات (لاحظ سارة في الأعلى لأنّها أنهت تقييمها للتوّ)، تحليلات شاملة، ورسوم مرئية.",
    spotlight: { selector: "main", label: "لوحة المسؤول" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act6-admin-interviews",
    act: "Act 6 — Admin",
    route: "/admin/interviews",
    narration: "إدارة المقابلات بشكل أعمق: فلترة بالحالة، البحث بالاسم، إجراءات جماعية.",
    spotlight: { selector: "main", label: "قائمة المقابلات" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act6-admin-settings",
    act: "Act 6 — Admin",
    route: "/admin/settings",
    narration:
      "أقوى صفحة في لوحة المسؤول: الإعدادات. خمسة تبويبات — بنك الأسئلة، الوظائف، الإعلانات، أوزان التقييم، وإدارة المستخدمين.",
    spotlight: { selector: "main", label: "إعدادات المنصّة" },
    durationEstimateMs: 15_000,
  },
  {
    id: "act6-candidate-detail",
    act: "Act 6 — Admin",
    narration:
      "ندخل على ملف سارة كاملاً. سيرتها، مقابلة تدريب، ومقابلة تقييم — كلها تحت ملف واحد. هذا التكامل هو جوهر المنصّة.",
    spotlight: { selector: "main", label: "ملف سارة" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act6-live-proctor",
    act: "Act 6 — Admin",
    route: "/admin/proctor",
    narration:
      "لوحة المراقبة تعرض المقابلات الجارية والمسجَّلة، مع flags لأحداث الغش لكل جلسة (تبديل تبويب، انعدام وجه، صوت غير المرشّح). اضغط على أي جلسة جارية للدخول إلى عرض المراقبة المباشر.",
    spotlight: { selector: "main", label: "المراقبة" },
    durationEstimateMs: 13_000,
  },

  // ────────────────────────────── ACT 6.5 — HR ─────────────────────────
  {
    id: "act6.5-session-swap-hr",
    act: "Act 6.5 — HR",
    narration: "غير المسؤول التقني، فِرَق الموارد البشرية لها لوحة مخصّصة. لنبدّل إلى حساب HR…",
    action: { kind: "swap-session", role: "hr" },
    durationEstimateMs: 7_000,
  },
  {
    id: "act6.5-hr-dashboard",
    act: "Act 6.5 — HR",
    route: "/dashboard/hr",
    narration:
      "لوحة الـ HR. مؤشّرات رئيسية: وقت التوظيف، معدّل التحويل، عدد المرشّحين في كل مرحلة.",
    spotlight: { selector: "main", label: "لوحة الـ HR" },
    durationEstimateMs: 10_000,
  },
  {
    id: "act6.5-pipeline",
    act: "Act 6.5 — HR",
    route: "/dashboard/hr/pipeline",
    narration:
      "خطّ التوظيف بشكل Kanban: تقديم ← فرز ← مقابلة ← عرض ← تعيين. خلّيني أحرّك بطاقة سارة مرحلة للأمام مباشرةً.",
    spotlight: { selector: "main", label: "خطّ التوظيف" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act6.5-compare",
    act: "Act 6.5 — HR",
    route: "/dashboard/hr/compare",
    narration:
      "ومقارنة المرشّحين جنبًا إلى جنب. سارة مقابل خالد. كل المقاييس: DISC، الدرجات، STAR، radar — في عَرض موحَّد.",
    spotlight: { selector: "main", label: "مقارنة المرشّحين" },
    durationEstimateMs: 13_000,
  },

  // ─────────────────────────── ACT 7 — INSTRUCTOR ──────────────────────
  {
    id: "act7-instructor",
    act: "Act 7 — Instructor",
    route: "/dashboard/instructor",
    narration:
      "وأخيرًا، جانب المدرّبين في معهد الإدارة العامة. دفعات (Cohorts)، طلّاب، مهام، وأهم ميزة: تعليقات على لحظات محدّدة من تسجيل المقابلة.",
    spotlight: { selector: "main", label: "لوحة المدرّب" },
    action: { kind: "swap-session", role: "instructor" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act7-cohort-detail",
    act: "Act 7 — Instructor",
    route: "/dashboard/instructor/cohort/demo",
    narration:
      "ندخل على دفعة محدّدة. قائمة الطلّاب، إحصائيات إنجاز المهام، وآخر مقابلاتهم — كل شيء بنظرة واحدة. هذي مو فقط لوحة عرض، هي workspace فعلي للمدرّب.",
    spotlight: { selector: "main", label: "تفاصيل الدفعة" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act7-timestamped-feedback",
    act: "Act 7 — Instructor",
    narration:
      "وأهم ميزة على الإطلاق للمدرّبين: تعليقات بـ timestamp على فيديو الطالب. اضغط على ٠٢:٣٥، اكتب 'هنا الإجابة دافعها ممتاز لكن انتقل بسرعة'، الطالب يشوف التعليق بالضبط على تلك اللحظة. تعليم سياقي، مو ملاحظات عامّة بعد الجلسة.",
    spotlight: { selector: "main", label: "تعليقات بـ timestamps" },
    durationEstimateMs: 14_000,
  },

  // ───────────────────────────── ACT 8 — CLOSE ─────────────────────────
  {
    id: "act8-recap",
    act: "Act 8 — Close",
    route: "/",
    narration:
      "وبهذا نختم الجولة. شفنا مسار المرشّح كاملًا — تسجيل، سيرة، مقابلتين حقيقيتين بصوت نورة الـ AI، نتائج فعلية، وجانب الـ HR والمدرّب. إذا عندك سؤال أخير، اضغط الميكروفون.",
    spotlight: { selector: "h1", label: "الختام" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act8-cta",
    act: "Act 8 — Close",
    route: "/login?tab=signup",
    narration:
      "إذا حابب تجرّب بنفسك، عبّي هذا النموذج بإيميلك الحقيقي. راح تبدأ من نفس المكان اللي بدأت منه سارة. شكراً وأهلًا بك في معهد الإدارة العامة.",
    spotlight: { selector: "form", label: "ابدأ مجاناً" },
    durationEstimateMs: 14_000,
  },
];
