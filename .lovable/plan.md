

## تحديث كود تسجيل المقابلة

### التغييرات

**ملف: `src/pages/TextInterview.tsx`**

**1. تعديل useEffect لبدء التسجيل (سطر 78-96):**
- استخدام codec `vp9,opus`
- إزالة `timeslice` من `recorder.start()`
- إزالة cleanup `stop` من هذا الـ useEffect

**2. تعديل upload logic (سطر 98-139):**
- استبدال `setTimeout(500)` بـ `await new Promise` مع `onstop` event
- انتظار فعلي لانتهاء التسجيل بدلاً من تأخير عشوائي

```typescript
// useEffect للتسجيل - بدون cleanup stop
useEffect(() => {
  if (!cheatCamera.stream || !session.interviewId) return;
  try {
    const recorder = new MediaRecorder(cheatCamera.stream, {
      mimeType: "video/webm;codecs=vp9,opus"
    });
    sessionChunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        sessionChunksRef.current.push(e.data);
      }
    };
    recorder.start(); // بدون timeslice
    sessionRecorderRef.current = recorder;
  } catch (err) {
    console.error("Failed to start session recorder:", err);
  }
}, [cheatCamera.stream, session.interviewId]);

// Upload - انتظار onstop بدل setTimeout
const uploadRecording = async () => {
  cheatCamera.stopAndUpload();

  if (sessionRecorderRef.current?.state === "recording") {
    await new Promise((resolve) => {
      sessionRecorderRef.current!.onstop = resolve;
      sessionRecorderRef.current!.stop();
    });
  }

  const blob = new Blob(sessionChunksRef.current, { type: "video/webm" });
  // ... باقي الرفع كما هو
};
```

