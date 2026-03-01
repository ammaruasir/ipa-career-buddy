

# Stunning Landing Page Redesign

## Overview
Complete rewrite of `src/pages/Index.tsx` with all requested sections: hero with animated gradient + stats bar, 3 feature cards, 4-step "How it Works", testimonials, sticky nav with mobile drawer, and comprehensive footer. Also add CSS animations for the gradient background.

## Single File Change
**`src/pages/Index.tsx`** — Full rewrite with:

### Sticky Navigation
- IPA logo + name on the right (RTL), nav links center (الرئيسية, المقابلات, التقارير, الدعم), auth buttons left
- When logged in: show user avatar dropdown with (لوحة التحكم, تسجيل الخروج)
- Mobile: hamburger icon opens `Sheet` drawer with nav links
- Uses `useAuth()` to detect login state

### Hero Section
- Animated gradient background (CSS keyframe `gradient-shift` added to `index.css`)
- Headline: "المقابلات الذكية - مستقبل التوظيف يبدأ هنا"
- Subheadline as specified
- Two CTAs: "ابدأ المقابلة التجريبية" (primary, links to `/interview/text`), "تعرف على المزيد" (outline, scrolls to `#features`)
- Decorative floating shapes with subtle animation
- Stats bar below hero: "١٠٠٠+ مقابلة" | "٩٥% دقة التحليل" | "٥٠+ شركة شريكة"

### Features Section (3 cards)
1. مقابلات فيديو ذكية — Video icon, AI analysis details
2. تحليل الشخصية الآلي — Brain icon, DISC assessment
3. تقارير احترافية — BarChart3 icon, PDF/certificates

### How It Works (4 steps)
Numbered circles with icons in a horizontal timeline layout:
1. سجل الدخول بحساب IPA
2. اختر نوع المقابلة
3. أجب على أسئلة الذكاء الاصطناعي
4. احصل على تقييم مفصل وشهادة

### Testimonials (3 cards)
Placeholder student quotes with avatar circles, IPA-colored accents

### Footer
- 3-column: links (سياسة الخصوصية, الشروط, مركز المساعدة), contact info, social icons
- Copyright: © 2026 معهد الإدارة العامة

## Additional Change
**`src/index.css`** — Add `@keyframes gradient-shift` for animated hero background

## No database or backend changes needed.

