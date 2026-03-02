

## خطة: إصلاح مشكلة عدم انتظار إجابة السؤال الأخير + الانتقال التلقائي بعد المقابلة

### المشكلة
في `useLiveInterview.ts` (سطر 427-433)، عندما يصل عدد الأسئلة للحد الأقصى، الكود يتكلم السؤال الأخير ثم **يستدعي `getClosingResponse()` مباشرة بدون الاستماع لإجابة المرشح**.

```text
المسار الحالي (خطأ):
السؤال الأخير → يُنطق → getClosingResponse() → توديع → endInterview()

المسار الصحيح:
السؤال الأخير → يُنطق → يستمع للإجابة → المرشح يجيب → getClosingResponse() → توديع → endInterview() → انتقال تلقائي
```

### التعديلات

| الملف | التعديل |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | **سطر 427-433**: بدلاً من استدعاء `getClosingResponse()` مباشرة بعد نطق السؤال الأخير، يتم إضافة علامة `lastQuestionRef` ونطق السؤال ثم `startListening()`. بعد استلام الإجابة في `handleRecordingComplete`، يتم التحقق من العلامة واستدعاء `getClosingResponse()` بدلاً من `getNextAIResponse()` |
| `src/hooks/useLiveInterview.ts` | التأكد أن `endInterview()` ينتقل للصفحة الرئيسية (موجود بالفعل سطر 538) |
| `src/hooks/useInterviewSession.ts` | **سطر 151**: نفس المشكلة — يتحقق من `questionCount >= totalQuestions` **قبل** أن يستمع للإجابة الأخيرة. الإصلاح: بعد استلام رد الـ AI على السؤال الأخير، ننتظر إجابة المرشح ثم نُنهي |

### التفاصيل التقنية

**`useLiveInterview.ts`** — إضافة `lastQuestionRef`:
- إضافة `const lastQuestionRef = useRef(false)`
- في `getNextAIResponse`: عند `newCount >= totalQuestions`، نضع `lastQuestionRef.current = true` ثم ننطق السؤال ونستمع عادياً (بدلاً من الإغلاق الفوري)
- في `handleRecordingComplete`: بعد حفظ إجابة المرشح، نتحقق `if (lastQuestionRef.current)` → نستدعي `getClosingResponse()` بدلاً من `getNextAIResponse()`

**`useInterviewSession.ts`** — إصلاح مماثل:
- إضافة `lastQuestionRef` للتتبع
- عند `questionCount + 1 >= totalQuestions` في `sendAnswer`: نعلّم أن السؤال التالي هو الأخير
- بعد رد الـ AI على السؤال الأخير وإجابة المرشح عليه → ننهي المقابلة وننتقل تلقائياً

