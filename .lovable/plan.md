

## التعديلات المطلوبة

### 1. نافذة النص المباشر قابلة للتمرير (ScrollArea)
في `LiveInterview.tsx`، نافذة الترانسكريبت حالياً تعرض آخر 6 رسائل فقط (`slice(-6)`) داخل `ScrollArea` بارتفاع محدود. التعديل:
- إزالة `slice(-6)` لعرض كل الرسائل
- جعل `ScrollArea` بارتفاع مناسب مع تمرير كامل من فوق لتحت

### 2. كتابة النص تدريجياً أثناء نطق الذكاء الاصطناعي (Streaming Effect)
حالياً: يُضاف النص كاملاً للترانسكريبت ثم يبدأ الصوت. التعديل:
- في `useLiveInterview.ts`: عند وصول رد الذكاء الاصطناعي، إضافة entry فارغة للترانسكريبت ثم كتابة الحروف تدريجياً (typewriter effect) بالتزامن مع بدء الصوت
- إضافة دالة `streamTextToTranscript` تكتب النص حرفاً حرفاً بسرعة مناسبة (~30ms لكل حرف)
- تشغيل `speakText` و `streamTextToTranscript` بالتوازي باستخدام `Promise.all`

### التدفق الجديد:
```text
قبل: رد AI → إضافة النص كامل → بدء الصوت
بعد: رد AI → إضافة entry فارغ → (كتابة تدريجية + صوت) معاً
```

### الملفات المعدّلة
- `src/components/interview/LiveInterview.tsx` — إزالة slice، تحسين ScrollArea
- `src/hooks/useLiveInterview.ts` — إضافة streaming text effect متزامن مع TTS

