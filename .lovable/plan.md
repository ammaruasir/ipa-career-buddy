

## خطة إصلاح مشكلة عدم ظهور تسجيل الفيديو

### المشكلة
تسجيل مقابلة Wakeb (interview: `787e6f85`) لم يُرفع — `recording_url = NULL` ولا يوجد ملف في التخزين. السبب: race condition في `endInterview` حيث يتم إيقاف `MediaRecorder` ثم انتظار 500ms ثابتة فقط بدلاً من انتظار حدث `onstop` الذي يضمن وصول كل البيانات.

### التعديل — `src/hooks/useLiveInterview.ts`

استبدال المنطق الحالي:
```text
// قبل (مشكلة):
sessionRecorderRef.current.stop();
await new Promise(resolve => setTimeout(resolve, 500));  // قد لا يكفي
const sessionBlob = new Blob(sessionChunksRef.current, ...);
```

بمنطق ينتظر حدث `onstop` فعلياً:
```typescript
// بعد (الإصلاح):
await new Promise<void>((resolve) => {
  const recorder = sessionRecorderRef.current!;
  recorder.onstop = () => resolve();
  recorder.stop();
});
// الآن sessionChunksRef.current مضمون يحتوي كل البيانات
const sessionBlob = new Blob(sessionChunksRef.current, { type: "video/webm" });
```

بالإضافة لإضافة logging في حال فشل الرفع أو كان حجم الملف صفر لتسهيل التتبع مستقبلاً.

### الملفات المعدّلة
- `src/hooks/useLiveInterview.ts`

