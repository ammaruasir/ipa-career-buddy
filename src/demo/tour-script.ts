import type { TourStep } from "./types";

// Coherent end-to-end demo for IPA Career Buddy.
// Persona: عبدالله من فريق واكب (human guide voice — never references "AI",
// "ذكاء اصطناعي", "LLM", "GPT", "روبوت"). Follows سارة الراشد from sign-up
// through CV → practice interview → formal assessment → HR processing →
// instructor wrap-up — one continuous story, ~40 steps, ~10-12 minutes.
//
// Spotlight selectors are SPECIFIC (data-tour=...) so the highlight rectangle
// fits the feature being discussed instead of wrapping the entire page.

export const tourScript: TourStep[] = [
  // ──────────────────────────── ACT 1 — HOOK ────────────────────────────
  {
    id: "act1-intro",
    act: "Act 1 — Hook",
    narration:
      "السلام عليكم. أنا عبدالله من فريق واكب. خلال الدقائق القادمة، راح أمشي معك خطوة بخطوة في منصّة معهد الإدارة العامة، وراح نتابع رحلة مرشّحة اسمها سارة من تسجيل الدخول لأوّل مرّة لين ما تصلها موافقة فريق التوظيف.",
    durationEstimateMs: 17_000,
  },
  {
    id: "act1-landing",
    act: "Act 1 — Hook",
    route: "/",
    narration:
      "هذي الصفحة الرئيسية. المنصّة تركّز على ثلاث رحلات: التدريب على المقابلات، بناء السيرة الذاتية، ومتابعة المدرّبين لطلّابهم. تعال نشوفها بالتطبيق.",
    spotlight: { selector: "main h1", label: "نظرة عامة" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act1-features",
    act: "Act 1 — Hook",
    route: "/features",
    narration:
      "هذي صفحة الميزات الكاملة. ستّ ركائز: التدريب الآمن، التقييم الرسمي، منشئ السيرة، محادثة بناء السيرة، تقييم السيرة، ولوحة المدرّب. كل وحدة منها راح تشوفها شغّالة قدّامك خلال الجولة.",
    spotlight: { selector: "main h1", label: "ستّ ركائز" },
    durationEstimateMs: 14_000,
  },

  // ──────────────────────────── ACT 2 — REGISTRATION ────────────────────
  {
    id: "act2-signup-form",
    act: "Act 2 — Registration",
    route: "/login?tab=signup",
    narration:
      "أوّل خطوة لأي مستخدم: التسجيل. خلّيني أعبّي الإيميل كنموذج. هنا تكتب اسمك وبريدك وكلمة السرّ، ويوصلك رابط تأكيد على إيميلك.",
    spotlight: { selector: "form", label: "نموذج التسجيل" },
    action: {
      kind: "type",
      selector: "input[type='email']",
      text: "sarah.alrashid@ipa.sa",
      speedMs: 38,
    },
    durationEstimateMs: 14_000,
  },
  {
    id: "act2-forgot-password",
    act: "Act 2 — Registration",
    route: "/login?forgot=true",
    narration:
      "وإذا في يوم نسيت كلمة السرّ، تضغط على رابط استرجاع الكلمة. تكتب بريدك، يوصلك رابط استعادة، وتعيّن كلمة جديدة. بسيط وآمن.",
    spotlight: { selector: "form", label: "استرجاع كلمة المرور" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act2-session-swap-candidate",
    act: "Act 2 — Registration",
    narration:
      "حسناً، خلّينا نتجاوز خطوة التحقّق ونكمّل وكأنّ سارة سجّلت دخولها للتوّ. راح أحوّل الجلسة لحساب تجريبي جاهز…",
    action: { kind: "swap-session", role: "candidate" },
    durationEstimateMs: 8_000,
  },
  {
    id: "act2-complete-profile",
    act: "Act 2 — Registration",
    route: "/complete-profile",
    narration:
      "أوّل مرّة تسجّل، تشوف هذي الصفحة — إكمال الملف الشخصي. الاسم، التخصّص، سنوات الخبرة، اللغة، والمدينة. هذي البيانات تساعد المنصّة تخصّص لك المقابلات المناسبة.",
    spotlight: { selector: "main h1, main h2", label: "إكمال الملف" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act2-first-dashboard",
    act: "Act 2 — Registration",
    route: "/dashboard/candidate",
    narration:
      "وأخيراً وصلنا للوحة سارة الشخصية. ثلاث بطاقات إحصائيات في الأعلى — عدد المقابلات، متوسّط التقييم، والجلسات الجارية.",
    spotlight: { selector: "[data-tour='candidate-stats']", label: "إحصائيات المرشّحة" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act2-pdpl-banner",
    act: "Act 2 — Registration",
    narration:
      "ولاحظ هذي النافذة المنبثقة — موافقة حماية البيانات السعودية. كل ميزة في المنصّة تتطلّب موافقة سارة الصريحة قبل إرسال أي بيانات لأي مزوّد. هذي ليست مجرّد علامة تأشير — هي التزام للخصوصية، خصوصاً للقطاع الحكومي.",
    spotlight: { selector: "[role='dialog'], [data-tour='consent-banner']", label: "موافقات PDPL" },
    durationEstimateMs: 13_000,
  },

  // ────────────────────────────── ACT 3 — BUILD CV ──────────────────────
  {
    id: "act3-cv-hub",
    act: "Act 3 — Build CV",
    route: "/cv",
    narration:
      "تعال نبدأ ببناء سيرة سارة. عندنا ثلاث طرق: محادثة موجَّهة من الصفر، منشئ يدوي بسبع خطوات، أو رفع سيرة موجودة للتقييم.",
    spotlight: { selector: "[data-tour='cv-method-cards']", label: "ثلاث طرق لبناء السيرة" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act3-cv-interview-open",
    act: "Act 3 — Build CV",
    route: "/cv/interview",
    narration:
      "خلّينا نجرّب المحادثة الموجَّهة. خمسة عشر سؤال — اسم، خبرة، إنجازات — والمنصّة تحوّل إجاباتك إلى مسوّدة احترافية بالمواصفات الصحيحة.",
    spotlight: { selector: "main", label: "محادثة بناء السيرة" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act3-cv-interview-start",
    act: "Act 3 — Build CV",
    narration: "نضغط زر البدء.",
    action: { kind: "click", selector: "[data-tour='cv-interview-start']", delayMs: 400 },
    durationEstimateMs: 5_000,
  },
  {
    id: "act3-cv-interview-answer",
    act: "Act 3 — Build CV",
    narration:
      "أوّل سؤال عادةً عن الاسم أو الدور المستهدف. سارة تكتب إجابتها — وفي كل سؤال لاحقاً نقدر نضغط زر الاقتراح وتجي صياغة جاهزة نعدّل عليها.",
    action: {
      kind: "type",
      selector: "[data-tour='cv-interview-answer']",
      text: "سارة الراشد، مهندسة واجهات أمامية، ٣ سنوات خبرة، أستهدف دور Senior Frontend في القطاع الحكومي.",
      speedMs: 25,
    },
    durationEstimateMs: 12_000,
  },
  {
    id: "act3-cv-interview-next",
    act: "Act 3 — Build CV",
    narration: "نضغط التالي وننتقل للسؤال اللي بعده. وبنفس الطريقة، أي مستخدم يقدر يبني سيرته من الصفر في عشر دقائق.",
    action: { kind: "click", selector: "[data-tour='cv-interview-next']", delayMs: 400 },
    durationEstimateMs: 8_000,
  },
  {
    id: "act3-cv-builder",
    act: "Act 3 — Build CV",
    route: "/cv/builder",
    narration:
      "الطريقة الثانية: المنشئ اليدوي بسبع خطوات. لاحظ المؤشرات في الأعلى — درجة ATS حيّة، خيارات القالب واللغة، زر مطابقة مع وظيفة، وزر رسالة التقديم. التواريخ تدعم هجري وميلادي.",
    spotlight: { selector: "main", label: "منشئ السيرة" },
    durationEstimateMs: 15_000,
  },
  {
    id: "act3-cv-job-align-open",
    act: "Act 3 — Build CV",
    narration: "ميزة فريدة: نطابق سيرة سارة مع وصف وظيفة محدّد. أضغط الزر…",
    action: { kind: "click", selector: "[data-tour='job-align']", delayMs: 500 },
    durationEstimateMs: 6_000,
  },
  {
    id: "act3-cv-job-align-paste",
    act: "Act 3 — Build CV",
    narration:
      "ألصق وصف الوظيفة المستهدفة — يطلع لك Match Score، كلمات مفتاحية متطابقة ومفقودة، واقتراحات لإعادة كتابة النقاط بكلمات الوصف نفسها.",
    action: {
      kind: "type",
      selector: "[data-tour='job-align-jd']",
      text: "نبحث عن مهندس واجهات أمامية Senior بخبرة ٤+ سنوات في React, TypeScript, Next.js. يقود تحسين الأداء وله خبرة في design systems وتجربة المستخدم. مطلوب فهم احتياجات القطاع الحكومي.",
      speedMs: 14,
    },
    durationEstimateMs: 14_000,
  },
  {
    id: "act3-cv-job-align-analyze",
    act: "Act 3 — Build CV",
    narration: "أضغط حلّل التوافق وأنتظر النتيجة.",
    action: { kind: "click", selector: "[data-tour='job-align-analyze']", delayMs: 400 },
    durationEstimateMs: 9_000,
  },
  {
    id: "act3-cv-export",
    act: "Act 3 — Build CV",
    route: "/cv/builder",
    narration:
      "وأخيراً، تصدير PDF فعلي. الـ PDF يحترم القالب المختار، الاتجاه من اليمين لليسار سليم، وخطوط عربية احترافية، ودعم ثنائي اللغة في ملف واحد للمتقدّمين للوظائف الدولية.",
    spotlight: { selector: "[data-tour='export-pdf']", label: "تصدير PDF" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act3-cv-review",
    act: "Act 3 — Build CV",
    route: "/cv/review?demo=preloaded",
    narration:
      "أمّا لو سارة عندها سيرة جاهزة وحابّة تقييم ثاني، تجي على صفحة التقييم. هنا نموذج جاهز — رسم radar لجودة الأقسام، نقاط ضعف، إعادات كتابة بتبريرات، وفحص امتثال للهجري وجدارات.",
    spotlight: { selector: "main", label: "تقييم السيرة" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act3-cv-chat-input",
    act: "Act 3 — Build CV",
    narration:
      "وأهم ميزة: تقدر تتحدّث مع سيرتك. اسأل عن أي قسم — يجيك جواب مدعوم بأمثلة محدّدة من نصّ سيرتك.",
    action: {
      kind: "type",
      selector: "[data-tour='cv-chat-input']",
      text: "لماذا قسم الإنجازات حصل على درجة منخفضة؟ وكيف أحسّنها؟",
      speedMs: 22,
    },
    durationEstimateMs: 11_000,
  },
  {
    id: "act3-cv-chat-send",
    act: "Act 3 — Build CV",
    narration: "نرسل السؤال ونستلم جواباً مفصّلاً.",
    action: { kind: "click", selector: "[data-tour='cv-chat-send']", delayMs: 400 },
    durationEstimateMs: 8_000,
  },

  // ─────────────────────── ACT 4 — PRACTICE INTERVIEW ───────────────────
  {
    id: "act4-dashboard-revisit",
    act: "Act 4 — Practice Interview",
    route: "/dashboard/candidate",
    narration:
      "ممتاز. سيرة سارة جاهزة الآن. الخطوة التالية هي التدريب — قبل ما تخوض المقابلة الرسمية، تقدر تجرّب أكثر من مرّة في وضع آمن لا تنحفظ نتائجه في ملفّها.",
    spotlight: { selector: "[data-tour='training-section']", label: "وضع التدريب" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act4-practice-open",
    act: "Act 4 — Practice Interview",
    route: "/interview/voice?practice=true&question_count=2",
    narration:
      "خلّيني أوريك جلسة تدريبية سريعة. سارة راح تخوض مقابلة قصيرة مع نورة، المحاوِرة في المنصّة. اسمع كيف تجري الأمور.",
    spotlight: { selector: "main", label: "بدء جلسة تدريب" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act4-pause-narrator",
    act: "Act 4 — Practice Interview",
    narration: "",
    action: { kind: "pause-voice" },
    durationEstimateMs: 3_000,
  },
  {
    id: "act4-start-interview",
    act: "Act 4 — Practice Interview",
    narration: "",
    action: { kind: "start-live-interview", mode: "practice", questionCount: 2 },
    durationEstimateMs: 15_000,
  },
  {
    id: "act4-turn-1",
    act: "Act 4 — Practice Interview",
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
    id: "act4-resume-comment",
    act: "Act 4 — Practice Interview",
    narration:
      "لاحظ كيف نورة طلبت مثال محدّد ورقم نتيجة. المنصّة تقيس عمق الإجابة وصحّة الـ STAR — لا فقط طول الكلام.",
    action: { kind: "resume-voice" },
    durationEstimateMs: 9_000,
  },
  {
    id: "act4-pause-2",
    act: "Act 4 — Practice Interview",
    narration: "",
    action: { kind: "pause-voice" },
    durationEstimateMs: 3_000,
  },
  {
    id: "act4-turn-2",
    act: "Act 4 — Practice Interview",
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
    id: "act4-end",
    act: "Act 4 — Practice Interview",
    narration: "",
    action: { kind: "end-live-interview" },
    durationEstimateMs: 6_000,
  },
  {
    id: "act4-wrap",
    act: "Act 4 — Practice Interview",
    narration: "خلصت الجلسة. خلّينا نشوف نتائجها الفعلية الآن.",
    action: { kind: "resume-voice" },
    durationEstimateMs: 7_000,
  },
  {
    id: "act4-results-overall",
    act: "Act 4 — Practice Interview",
    route: (ctx) =>
      ctx.lastInterviewId
        ? `/interview/${ctx.lastInterviewId}/results`
        : "/dashboard/candidate",
    narration:
      "هذي نتائج المقابلة اللي للتوّ شفناها — درجة شاملة محسوبة من خمسة أبعاد، وتقييم DISC للشخصية، ومؤشّر التوصية النهائية.",
    spotlight: { selector: "[data-tour='overall-score']", label: "الدرجة الإجمالية" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act4-results-disc",
    act: "Act 4 — Practice Interview",
    narration:
      "نوع شخصية سارة بحسب نظام DISC، وملاحظات المنصّة على ثقتها في الإجابات، كلمات الحشو، وسرعة الكلام.",
    spotlight: { selector: "[data-tour='disc-and-metrics']", label: "DISC ومؤشّرات إضافية" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act4-results-star",
    act: "Act 4 — Practice Interview",
    narration:
      "وهذي قيمة المنصّة الحقيقية: تغذية راجعة لكل إجابة بأسلوب STAR. تقييم منفصل للموقف والمهمّة والإجراء والنتيجة، ونسخة محسَّنة بجانب نسخة سارة. تتعلّم لماذا تخسر النقاط — لا فقط أنّك خسرتها.",
    spotlight: { selector: "[data-tour='star-coaching']", label: "تغذية STAR" },
    durationEstimateMs: 15_000,
  },

  // ─────────────────────── ACT 5 — FORMAL ASSESSMENT ────────────────────
  {
    id: "act5-jobs",
    act: "Act 5 — Formal Assessment",
    route: "/jobs",
    narration:
      "تدرّبت سارة، أتقنت الإطار، وقت التطبيق الحقيقي. هذي صفحة الوظائف المتاحة. تختار وظيفة، تقدّم عليها، وتدخل في تقييم رسمي مُسجَّل بدرجات.",
    spotlight: { selector: "main", label: "الوظائف المتاحة" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act5-assessment-open",
    act: "Act 5 — Formal Assessment",
    route: "/interview/voice?job=%D8%B9%D8%A7%D9%85&question_count=2",
    narration:
      "نفس الفكرة بس في الوضع الرسمي. تتطلّب موافقة صريحة وفحص ميكروفون، ثم تنطلق الجلسة المُسجَّلة. تعال نشوفها قصيرة.",
    spotlight: { selector: "main", label: "المقابلة الرسمية" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act5-pause",
    act: "Act 5 — Formal Assessment",
    narration: "",
    action: { kind: "pause-voice" },
    durationEstimateMs: 3_000,
  },
  {
    id: "act5-start",
    act: "Act 5 — Formal Assessment",
    narration: "",
    action: { kind: "start-live-interview", mode: "assessment", questionCount: 2 },
    durationEstimateMs: 15_000,
  },
  {
    id: "act5-turn-1",
    act: "Act 5 — Formal Assessment",
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
    id: "act5-resume-comment",
    act: "Act 5 — Formal Assessment",
    narration:
      "الجلسة الرسمية مُسجَّلة، وفيها فحص للهوية وكشف للغش. المعايير أصرم من التدريب لأنّ هذي الدرجة راح تذهب لفريق التوظيف فعلياً.",
    action: { kind: "resume-voice" },
    durationEstimateMs: 10_000,
  },
  {
    id: "act5-pause-2",
    act: "Act 5 — Formal Assessment",
    narration: "",
    action: { kind: "pause-voice" },
    durationEstimateMs: 3_000,
  },
  {
    id: "act5-turn-2",
    act: "Act 5 — Formal Assessment",
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
    id: "act5-end",
    act: "Act 5 — Formal Assessment",
    narration: "",
    action: { kind: "end-live-interview" },
    durationEstimateMs: 6_000,
  },
  {
    id: "act5-results",
    act: "Act 5 — Formal Assessment",
    route: (ctx) =>
      ctx.lastInterviewId
        ? `/interview/${ctx.lastInterviewId}/results`
        : "/dashboard/candidate",
    narration:
      "نتائج المقابلة الرسمية تشبه التدريبية لكن مع تقييم مرجَّح بدرجة نهائية — تقني ٤٠٪، تواصل ٣٠٪، ملاءمة ثقافية ٣٠٪. هذي الدرجة الآن مرئيّة لفريق التوظيف.",
    action: { kind: "resume-voice" },
    spotlight: { selector: "[data-tour='overall-score']", label: "النتيجة المرجَّحة" },
    durationEstimateMs: 14_000,
  },

  // ───────────────────── ACT 6 — HR PROCESSES THE CANDIDATE ─────────────
  {
    id: "act6-bridge",
    act: "Act 6 — HR Processing",
    narration:
      "تمام، انتهى دور سارة. تعال نشوف كيف فريق التوظيف يتعامل مع طلبها الآن. راح أبدّل لحساب موارد بشرية تجريبي…",
    action: { kind: "swap-session", role: "hr" },
    durationEstimateMs: 9_000,
  },
  {
    id: "act6-hr-dashboard",
    act: "Act 6 — HR Processing",
    route: "/dashboard/hr",
    narration:
      "لوحة فريق التوظيف. مؤشّرات رئيسية: إجمالي المرشّحين، السير المرفوعة، المهارات المستخرجة، والمهارات الفريدة.",
    spotlight: { selector: "[data-tour='hr-stats']", label: "مؤشّرات الـ HR" },
    durationEstimateMs: 12_000,
  },
  {
    id: "act6-hr-candidates",
    act: "Act 6 — HR Processing",
    narration:
      "وهنا جدول المرشّحين. تقدر تفلتر بالمهارة، تطابق المرشّحين مع وظيفة، وتفتح ملف أي شخص بتفاصيله الكاملة. سارة موجودة في القائمة لأنّها أكملت تقييمها للتوّ.",
    spotlight: { selector: "[data-tour='hr-candidates-table']", label: "جدول المرشّحين" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act6-pipeline",
    act: "Act 6 — HR Processing",
    route: "/dashboard/hr/pipeline",
    narration:
      "خطّ التوظيف بنظام Kanban: مقدّم، فرز، مقابلة، عرض وظيفي، تعيين. كل بطاقة قابلة للسحب والإفلات بين الأعمدة. خلّيني أوريك عمود المقابلة — هنا فريق التوظيف يجمع المرشّحين الجاهزين للجولة التالية.",
    spotlight: { selector: "[data-tour='pipeline-column-interviewing']", label: "عمود المقابلة" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act6-compare",
    act: "Act 6 — HR Processing",
    route: "/dashboard/hr/compare",
    narration:
      "ولمّا يصير عند فريق التوظيف عدّة مرشّحين على نفس الوظيفة، يستخدمون شاشة المقارنة. رسم radar يقارن المرشّحين على كل بُعد، وجدول مقارنة تفصيلي. سارة مقابل خالد مثلاً.",
    spotlight: { selector: "[data-tour='compare-radar']", label: "مقارنة المرشّحين" },
    durationEstimateMs: 14_000,
  },
  {
    id: "act6-decision",
    act: "Act 6 — HR Processing",
    narration:
      "بناءً على هذي البيانات الكاملة — درجة التقييم الرسمي، تحليل DISC، ومقارنة مع المرشّحين الآخرين — فريق التوظيف يقرّر يرفع سارة لمرحلة العرض الوظيفي.",
    spotlight: { selector: "[data-tour='compare-radar']", label: "قرار الترقية" },
    durationEstimateMs: 10_000,
  },

  // ──────────────────── ACT 7 — INSTRUCTOR WRAPS UP ─────────────────────
  {
    id: "act7-bridge",
    act: "Act 7 — Instructor",
    narration:
      "وبموازاة كل هذا، مدرّبة سارة في معهد الإدارة العامة كانت تتابع جلساتها التدريبية وتقدّم لها ملاحظات. خلّيني أبدّل لحساب مدرّبة لنشوف هذي الزاوية.",
    action: { kind: "swap-session", role: "instructor" },
    durationEstimateMs: 11_000,
  },
  {
    id: "act7-cohort-detail",
    act: "Act 7 — Instructor",
    route: "/dashboard/instructor/cohort/demo",
    narration:
      "هذي تفاصيل دفعة سارة. قائمة الطلّاب، إحصائيات إنجاز المهام، وآخر مقابلاتهم. كل شيء بنظرة واحدة. هذي مو فقط لوحة عرض، هي مساحة عمل فعلية للمدرّبة.",
    spotlight: { selector: "[data-tour='cohort-students']", label: "طلّاب الدفعة" },
    durationEstimateMs: 13_000,
  },
  {
    id: "act7-timestamped",
    act: "Act 7 — Instructor",
    narration:
      "ومن هنا، المدرّبة تتابع كل طالب على حدة — تشوف جلساته، إجاباته، وتتركله ملاحظات مرتبطة بلحظات محدّدة من فيديو المقابلة. تعليم سياقي، مو ملاحظات عامّة بعد الجلسة.",
    spotlight: { selector: "[data-tour='cohort-students']", label: "متابعة الطلّاب" },
    durationEstimateMs: 14_000,
  },

  // ────────────────────────────── ACT 8 — CLOSE ────────────────────────
  {
    id: "act8-recap",
    act: "Act 8 — Close",
    route: "/",
    narration:
      "وبهذا نختم الجولة. في حوالي عشر دقائق، شفنا سارة وهي تسجّل دخولها لأوّل مرّة، تبني سيرتها، تتدرّب وتتلقّى ملاحظات على كل إجابة، تخوض مقابلتها الرسمية، تنتقل لمرحلة العرض الوظيفي، ومدرّبتها متابعة معها طول الرحلة. هذي قصّة سارة — وقصّة كل مستخدم في المنصّة.",
    spotlight: { selector: "main h1", label: "الختام" },
    durationEstimateMs: 18_000,
  },
  {
    id: "act8-cta",
    act: "Act 8 — Close",
    route: "/login?tab=signup",
    narration:
      "إذا حابب تجرّب بنفسك، عبّي هذا النموذج بإيميلك الحقيقي. راح تبدأ من نفس المكان اللي بدأت منه سارة. شكراً، وأهلاً بك في معهد الإدارة العامة.",
    spotlight: { selector: "form", label: "ابدأ مجاناً" },
    durationEstimateMs: 14_000,
  },
];
