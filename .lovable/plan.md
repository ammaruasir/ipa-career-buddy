

## خطة: إضافة كاميرا المرشح وتحليل الفيديو بالذكاء الاصطناعي في المقابلة المباشرة

حالياً مقابلة الفيديو المباشرة تعرض فقط الأفاتار الآلي بدون إظهار كاميرا المرشح. هذه الخطة تضيف عرض كاميرا المرشح + التقاط لقطات تلقائية + تحليلها بالذكاء الاصطناعي.

### التغييرات

**1. `src/hooks/useLiveInterview.ts`**
- إضافة `videoRef` لتخزين مرجع عنصر الفيديو
- عند `type === "video"`: طلب `getUserMedia({ video: true, audio: true })` بدلاً من `audio` فقط
- تخزين video stream في ref جديد وإعادته للـ component
- عند اكتمال كل إجابة (`handleRecordingComplete`): التقاط 3 إطارات (frames) من الفيديو باستخدام Canvas
- إرسال الإطارات مع `response_id` إلى edge function `analyze-video`
- إرجاع `videoStream` من الـ hook

**2. `src/components/interview/LiveInterview.tsx`**
- عند `type === "video"`: عرض عنصر `<video>` صغير (picture-in-picture style) في الزاوية يعرض كاميرا المرشح
- ربط الـ stream بعنصر الفيديو عبر `srcObject`

**3. `supabase/functions/analyze-video/index.ts`**
- لا تغييرات — الدالة موجودة وتعمل بالفعل مع Lovable AI gateway

### التفاصيل التقنية

التقاط الإطارات يتم عبر:
```typescript
const canvas = document.createElement("canvas");
const video = videoElementRef.current;
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
canvas.getContext("2d").drawImage(video, 0, 0);
const frame = canvas.toDataURL("image/jpeg", 0.6);
```

يتم إرسال 3 إطارات (بداية، منتصف، نهاية الإجابة) إلى `analyze-video` بعد حفظ الإجابة في DB للحصول على `response_id`.

### الملفات المعدلة
- `src/hooks/useLiveInterview.ts`
- `src/components/interview/LiveInterview.tsx`

