// Demo candidate persona used by demo-candidate-bot and seeded into the demo
// data tables so the same سعد appears in CV chat → practice interview →
// assessment interview → admin views → HR comparison.

export const demoCandidate = {
  fullName: "سعد الراشد",
  arabicGivenName: "سعد",
  email: "demo-candidate@ipa-training.sa",
  targetRole: "مهندس واجهات أمامية (Frontend Engineer)",
  background: {
    yearsExperience: 3,
    currentRoleSummary:
      "مهندس واجهات أمامية في شركة فينتك ناشئة في جدّة، يعمل على لوحات تحكّم داخلية ومنتج موجَّه للعملاء.",
    education: "بكالوريوس علوم حاسب من جامعة الملك عبدالعزيز، تخرّج ٢٠٢٢ بمرتبة الشرف.",
    city: "جدّة",
  },
  skills: {
    technical: ["React", "TypeScript", "Next.js", "Tailwind CSS", "WCAG accessibility", "Design Systems"],
    soft: ["تواصل واضح", "حلّ مشكلات", "عمل جماعي", "تعلّم ذاتي"],
    languages: ["العربية (الأم)", "الإنجليزية (متقدّم — IELTS 7.0)"],
  },
  discTilt: "Conscientious-Influential (CI)",
  notableProjects: [
    {
      title: "إعادة بناء بوّابة العملاء",
      situation: "البوّابة القديمة بطيئة (LCP > 4s) ومعدّل التحوّل ٢.١٪.",
      task: "قيادة إعادة الكتابة بـ Next.js مع إبقاء التوافق مع APIs الحالية.",
      action: "هيكلة جديدة، SSR + CDN caching، تنسيق مع فريق UX.",
      result: "LCP = ١.٢s، التحوّل ٣.٨٪، +٢٢ نقطة NPS.",
    },
    {
      title: "نظام تصميم مشترك",
      situation: "ثلاثة منتجات بتصاميم متضاربة.",
      task: "بناء design system موحَّد.",
      action: "Storybook + tokens مشتركة + ورش تدريبية.",
      result: "وقت البناء −٤٠٪، Bug tickets بصرية −٦٥٪.",
    },
    {
      title: "تحسين أداء واجهة موبايل",
      situation: "FID > 300ms، Bounce ٤٥٪.",
      task: "FID أقلّ من ١٠٠ms خلال ربع.",
      action: "code splitting + lazy-loading + إزالة polyfills.",
      result: "FID = ٦٨ms، Bounce ٣١٪، +١٨٪ إيراد موبايل.",
    },
  ],
  motivations: [
    "تطوير منتجات تخدم المواطن السعودي يوميًا (رؤية ٢٠٣٠).",
    "بيئة عالية المعايير مع زملاء أكفّاء.",
    "بناء نظم مرنة وقابلة للقياس.",
  ],
};

export type DemoCandidate = typeof demoCandidate;
