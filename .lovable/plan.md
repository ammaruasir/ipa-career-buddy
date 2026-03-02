

## المشكلة
حالياً نص المحاور الآلي يظهر حرفاً بحرف بالتوازي مع الكلام الصوتي (`Promise.all([streamTextToTranscript(), speakText()])`). المطلوب: إظهار النص **بعد** انتهاء الكلام الصوتي.

## التعديل — `src/hooks/useLiveInterview.ts`

في دالة `getNextAIResponse` (سطور 427-434):

1. **تغيير الترتيب**: بدلاً من `Promise.all` الذي يشغل النص والصوت معاً، نشغل `speakText` أولاً ثم بعد انتهائه نضيف النص كاملاً للـ transcript مباشرة (بدون تأثير الكتابة حرف بحرف).

2. **استبدال `streamTextToTranscript`** بإضافة مباشرة:
```text
// قبل:
await Promise.all([streamTextToTranscript(), speakText(aiText)]);

// بعد:
await speakText(aiText);
// أضف النص كاملاً بعد انتهاء الكلام
transcriptRef.current = [...transcriptRef.current, { role: "assistant", text: aiText }];
setTranscript([...transcriptRef.current]);
```

3. نفس التعديل يُطبق على الحالتين: السؤال الأخير (سطر 427) والأسئلة العادية (سطر 434).

### الملفات المعدّلة
- `src/hooks/useLiveInterview.ts`

