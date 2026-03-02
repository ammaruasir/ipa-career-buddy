

## المشكلتان

### 1. لقطات الغش لا تُحفظ ولا تُعرض
عمود `frame_url` في جدول `cheat_events` موجود لكن:
- **في `analyze-video/index.ts`**: عند إدراج أحداث الغش (سطر 166-174)، لا يتم حفظ الفريم (الصورة) في Storage ولا تعبئة `frame_url`
- **في `CandidateDetail.tsx`**: عند عرض أحداث الغش (سطر 409-436)، لا يُعرض `frame_url` حتى لو كان موجوداً

### 2. تسجيلات الفيديو
`VideoPlayback` موجود ويُعرض في صفحة المرشح (سطر 394-396). يعمل إذا كانت التسجيلات محفوظة في Storage. هذا الجزء يبدو سليماً.

## الحل

### 1. تعديل `supabase/functions/analyze-video/index.ts`
عند كشف حدث غش، نحفظ أول فريم من الـ batch في Storage bucket `interview-recordings` ونعبّئ `frame_url`:

```typescript
// لكل حدث غش: حفظ الفريم في Storage
const frameData = frames[0]; // أول لقطة من الدفعة
const frameBuffer = decode(frameData.split(",")[1]); // base64 → Uint8Array
const framePath = `cheat-frames/${actualInterviewId}/${Date.now()}_${e.event_type}.jpg`;
const { data: uploadData } = await supabase.storage
  .from("interview-recordings")
  .upload(framePath, frameBuffer, { contentType: "image/jpeg", upsert: true });

// إضافة frame_url للحدث
const { data: signedUrl } = await supabase.storage
  .from("interview-recordings")
  .createSignedUrl(framePath, 86400 * 365); // سنة
```

### 2. تعديل `src/pages/CandidateDetail.tsx`
في قسم عرض أحداث الغش، نضيف عرض الصورة عند الضغط على الحدث:
- إضافة state لـ `selectedCheatFrame`
- عند الضغط على حدث غش له `frame_url`، يُعرض في Dialog مع الصورة
- إضافة أيقونة كاميرا تدل على وجود لقطة

### 3. تعديل `supabase/functions/analyze-video/index.ts` — حفظ `frame_url` في الإدراج
تحديث rows ليشمل `frame_url` لكل حدث

### الملفات المعدّلة
- `supabase/functions/analyze-video/index.ts` — حفظ لقطة الفريم في Storage وتعبئة `frame_url`
- `src/pages/CandidateDetail.tsx` — عرض لقطة الغش عند الضغط على الحدث في Dialog

