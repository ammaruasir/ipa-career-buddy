

## خطة: تنفيذ المناقشة التفاعلية + كاميرا الغش في جميع الأوضاع

### الجزء 1: الأسئلة التتبعية والمناقشة

**`supabase/functions/chat/index.ts`** — إضافة تعليمات للبرومبت:
- إضافة قواعد المتابعة: "إذا كانت الإجابة غامضة أو مثيرة، اسأل سؤال تتبعي واحد قبل الانتقال"
- طلب بدء الرد بـ `[NEW_Q]` أو `[FOLLOW_UP]`

**`src/hooks/useLiveInterview.ts`** — تعديل `handleRecordingComplete`:
- فحص رد الـ AI: إذا بدأ بـ `[FOLLOW_UP]` لا نزيد العداد
- إذا بدأ بـ `[NEW_Q]` نزيد العداد
- إزالة العلامة من النص قبل العرض والنطق

**`src/hooks/useInterviewSession.ts`** — تعديل `sendAnswer`:
- نفس المنطق: فحص `[NEW_Q]`/`[FOLLOW_UP]` في رد الـ AI
- `setQuestionCount(c => c + 1)` فقط عند `[NEW_Q]`

### الجزء 2: كاميرا مراقبة الغش في النص والصوت

**`src/pages/TextInterview.tsx`**:
- فتح الكاميرا عند بدء المقابلة (عرض مصغّر PiP في زاوية الشاشة)
- التقاط صورة كل 30 ثانية وإرسالها لـ `analyze-video` مع `response_id`

**`src/hooks/useLiveInterview.ts`** (وضع الصوت):
- فتح كاميرا تلقائياً حتى في وضع الصوت
- التقاط صور دورية كل 30 ثانية وإرسالها للتحليل

**`src/components/interview/LiveInterview.tsx`**:
- عرض كاميرا PiP حتى في وضع الصوت (موجودة فقط للفيديو حالياً)

### الملفات المعدلة
- `supabase/functions/chat/index.ts`
- `src/hooks/useLiveInterview.ts`
- `src/hooks/useInterviewSession.ts`
- `src/pages/TextInterview.tsx`
- `src/components/interview/LiveInterview.tsx`

