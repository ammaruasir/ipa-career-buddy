# التغيير المطلوب

إعادة تسمية جميع نصوص الواجهة الظاهرة للمستخدم في مسار السيرة الذاتية لتنسب الاقتراحات إلى **واكب AI / Wakeb AI** بدل "AI" أو "الذكاء" المجرّدة، توافقاً مع الهوية الرسمية للمنصّة (WAKEB AI Engine).

النطاق: نصوص واجهة فقط (UI copy). لا تغيير في المنطق، الـ endpoints، أو الـ system prompts.

# الملفات المعدّلة

## ١) `src/pages/CVInterview.tsx`
- `suggestAi`: "اطلب اقتراح AI" → **"اطلب اقتراح واكب AI"** / "Get AI suggestion" → **"Get Wakeb AI suggestion"**
- `suggesting`: "AI يفكّر..." → **"واكب AI يفكّر..."** / "AI is thinking..." → **"Wakeb AI is thinking..."**
- `suggestionTitle`: "اقتراح من AI..." → **"اقتراح من واكب AI..."** / "AI suggestion..." → **"Wakeb AI suggestion..."**
- intro: "...يولّد AI اقتراحاً..." → **"...يولّد واكب AI اقتراحاً..."** / "...AI suggestion..." → **"...Wakeb AI suggestion..."**
- toast الفارغ (السطر 434-435): "AI will improve" → **"Wakeb AI will improve"** / "وسيحسّنها AI" → **"وسيحسّنها واكب AI"**

## ٢) `src/components/cv-builder/CVChatPanel.tsx`
- `title`: "تحدّث مع AI..." → **"تحدّث مع واكب AI..."** / "Chat with AI..." → **"Chat with Wakeb AI..."**
- intro: "AI سيشرح..." → **"واكب AI سيشرح..."** / "AI will explain..." → **"Wakeb AI will explain..."**
- زر "اعتمد كتحسين": لا تغيير (لا يذكر AI).
- ليبل "النص المُحسَّن (من الذكاء)" → **"النص المُحسَّن (من واكب AI)"** / "(from AI)" → **"(from Wakeb AI)"**

## ٣) `src/components/cv-hub/CVHubSection.tsx` (بطاقات الطرق الثلاث)
- "AI يقترح إجابات نموذجية" → **"واكب AI يقترح إجابات نموذجية"**
- "AI suggestions في كل سؤال" → **"اقتراحات واكب AI في كل سؤال"**
- "زر AI لتحويل أي وصف..." → **"زر واكب AI لتحويل أي وصف..."**
- "AI assist عند الطلب" → **"مساعدة واكب AI عند الطلب"**
- "محادثة AI تشرح لماذا" → **"محادثة واكب AI تشرح لماذا"**
- الهيدر السفلي: "كلها بـ AI..." → **"كلها بـ واكب AI..."**

## ٤) `src/pages/Features.tsx`
- "يحاورك AI بـ ١٥ سؤال" → **"يحاورك واكب AI بـ ١٥ سؤال"**
- "تطلب اقتراحاً من AI" → **"تطلب اقتراحاً من واكب AI"**
- "AI suggestion في كل سؤال" → **"اقتراح واكب AI في كل سؤال"**
- "منشئ يدوي مع AI assist" → **"منشئ يدوي مع مساعدة واكب AI"**
- "زر ✨ AI..." → **"زر ✨ واكب AI..."**, "AI يحوّله إلى STAR..." → **"واكب AI يحوّله إلى STAR..."**

## ٥) `supabase/functions/cv-interview-step/index.ts`
- `hint_ar/en` للخبرات: "AI سيحوّلها لـ STAR" → **"واكب AI سيحوّلها لـ STAR"** / "AI will polish" → **"Wakeb AI will polish"**

# خارج النطاق
- لا تعديل على رسائل error/console الداخلية (مخفية عن المستخدم).
- لا تعديل على system prompts للنماذج (يبقى تعليم النموذج بالإنجليزية للأداء).
- لا تعديل على باقي صفحات المقابلات/التدريب (لها branding مستقلّ في Core memory).
