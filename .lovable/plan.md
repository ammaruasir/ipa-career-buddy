

## الخطة — إضافة زر "إرسال الرد" اليدوي

### الفكرة
إضافة زر يظهر أثناء استماع الذكاء الاصطناعي (`isListening`) يتيح للمرشح إرسال رده فوراً بدون انتظار كشف الصمت التلقائي. الزر يوقف التسجيل يدوياً مما يُطلق نفس تدفق المعالجة التلقائي.

### التعديلات

#### 1. `src/hooks/useLiveInterview.ts`
- إضافة دالة `submitAnswer` تقوم بإيقاف `mediaRecorder` يدوياً (`recorder.stop()`) — هذا يُطلق حدث `onstop` الموجود أصلاً الذي يعالج الصوت تلقائياً
- تصدير `submitAnswer` من الـ hook

#### 2. `src/components/interview/LiveInterview.tsx`
- إضافة زر "إرسال الرد" (أيقونة Send) يظهر فقط عندما `isListening === true`
- الزر يستدعي `live.submitAnswer()`
- يوضع بجانب زر "إنهاء المقابلة" في منطقة التحكم

### الملفات المعدّلة
- `src/hooks/useLiveInterview.ts`
- `src/components/interview/LiveInterview.tsx`

