

## المشكلة

عند بدء مقابلة، يتم تحديث حالة طلب التوظيف (`job_applications.status`) إلى `"interviewing"`. لكن عند **انتهاء** المقابلة، الكود يحدّث فقط `interviews.status = "completed"` ولا يرجع يحدّث `job_applications.status`.

النتيجة: تبقى الطلبات عالقة بحالة "قيد المقابلة" حتى بعد اكتمال المقابلة.

**البيانات الحالية:**
- 8 طلبات بحالة `interviewing` في عمود `status`
- لا يوجد كود يحدّث هذه الحالة بعد إنهاء المقابلة

## الحل

تحديث `job_applications.status` إلى `"interviewed"` عند اكتمال المقابلة في ملفين:

### 1. `src/hooks/useLiveInterview.ts` (المقابلات الصوتية والمرئية)
بعد السطر الذي يحدّث `interviews.status = "completed"` (سطر ~463-466)، نضيف:
```typescript
// Update job application status
if (vacancyId) {
  await supabase
    .from("job_applications")
    .update({ status: "interviewed" } as any)
    .eq("vacancy_id", vacancyId)
    .eq("user_id", user.id);
}
```

### 2. `src/hooks/useInterviewSession.ts` (المقابلات النصية)
بعد السطر الذي يحدّث `interviews.status = "completed"` (سطر ~135-138)، نضيف نفس الكود.

### 3. إصلاح البيانات الحالية
تحديث الطلبات العالقة حالياً بحالة `interviewing` التي مقابلاتها مكتملة إلى `interviewed`.

### 4. تحديث عرض الحالة
التأكد أن `CandidateDashboard` و `HRDashboard` يعرضان حالة `interviewed` بشكل صحيح.

**الملفات المعدّلة:** `useLiveInterview.ts`، `useInterviewSession.ts`، وربما `CandidateDashboard.tsx`

