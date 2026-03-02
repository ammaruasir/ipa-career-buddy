

## لماذا لا يظهر تسجيل الفيديو

### المشاكل المكتشفة

1. **`recording_url` فارغ (null)**: المقابلة الحالية (`3c8ec067`) ليس لها ملف تسجيل `_full.webm` في التخزين. فقط لقطات كشف الغش موجودة. هذا يعني أن التسجيل لم يتم رفعه أصلاً.

2. **السبب الجذري — تعارض بين التنظيف والرفع**: عند انتهاء المقابلة، دالة التنظيف (cleanup effect) في السطور 696-717 توقف الـ streams فوراً عند تفكيك المكون. إذا حصل navigation قبل اكتمال الرفع في `endInterview`، يتم قطع الاتصال والتسجيل يضيع.

3. **رابط عام لـ bucket خاص**: حتى لو تم الرفع، الكود يحفظ `getPublicUrl` في قاعدة البيانات، لكن bucket `interview-recordings` خاص — فالرابط لن يعمل. يجب استخدام `createSignedUrl` بدلاً منه.

4. **VideoPlayback يعتمد على `recording_url` أو البحث في التخزين**: بما أن كلاهما فارغ، لا يظهر شيء.

### الحل المقترح — ملفان

**1. `src/hooks/useLiveInterview.ts`**:
- نقل عملية الرفع والتقييم **قبل** أي navigation
- إضافة `await` صريح لكل العمليات قبل الانتقال
- حذف `getPublicUrl` واستخدام المسار فقط (`${user.id}/${interviewId}_full.webm`) كـ `recording_url` في قاعدة البيانات
- منع cleanup effect من إيقاف الـ streams إذا كان `endInterview` يعمل حالياً (إضافة ref `isEndingRef`)

**2. `src/components/interview/VideoPlayback.tsx`**:
- تعديل المنطق ليستخدم `createSignedUrl` دائماً بدلاً من الاعتماد على public URL
- إذا كان `recordingUrl` هو مسار نسبي (ليس URL كامل)، استخدمه مباشرة مع `createSignedUrl`
- تحسين البحث في التخزين ليشمل مسار `cheat-frames/` أيضاً إذا لزم الأمر

### التفاصيل التقنية

```text
endInterview() flow (fixed):
  1. Stop MediaRecorder
  2. await onstop promise (get all chunks)
  3. Create blob
  4. Upload blob to storage
  5. Save file path (not public URL) to interviews.recording_url
  6. Update interview status
  7. Trigger evaluation
  8. Navigate to dashboard

cleanup effect:
  - Check isEndingRef — if true, skip stopping streams
  - Only force-stop if user navigated away without ending properly
```

### الملفات المعدّلة
- `src/hooks/useLiveInterview.ts`
- `src/components/interview/VideoPlayback.tsx`

