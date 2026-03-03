

## تحسين كود كشف الغش — إصلاح 3 مشاكل

### الملف: `src/hooks/useCheatCamera.ts`

| المشكلة | الإصلاح |
|---------|---------|
| **Memory Explosion** — تخزين base64 strings في الذاكرة (كل إطار ~100KB) | تخزين `Blob` في الـ buffer بدل base64، وتحويل إلى base64 فقط عند الإرسال (الـ edge function تتطلب data URLs) |
| **sendBatch بدون حماية** — لا try/catch ولا await في stopAndUpload | إضافة try/catch + جعل `stopAndUpload` ينتظر `sendBatch` بـ await |
| **التقاط كل ثانية زيادة** — استهلاك عالي بدون فائدة | تغيير الافتراضي إلى 2 ثانية + إضافة `readyState < 2` check |

### التعديلات بالتفصيل

1. **`framesBufferRef`** → `Blob[]` بدل `string[]`
2. **`captureFrame`** → `canvas.toBlob(blob => push, "image/jpeg", 0.6)` + فحص `readyState`
3. **`sendBatch`** → async مع try/catch، يحوّل Blobs إلى base64 data URLs قبل الإرسال
4. **`stopAndUpload`** → `await sendBatch()` ثم `await new Promise(onstop)`
5. **`captureIntervalMs`** الافتراضي → `2000` بدل `1000`

> ملاحظة: الـ edge function `analyze-video` تتوقع `image_url` كـ data URL string، لذلك التحويل يتم عند الإرسال فقط وليس عند التخزين.

