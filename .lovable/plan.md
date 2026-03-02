

## المشكلة

يوجد **13 مقابلة عالقة بحالة `in_progress`** في قاعدة البيانات. السبب:

1. **عند إغلاق الصفحة أو التنقل بعيداً**: دالة `useEffect` cleanup (سطر 656-667) توقف الميديا فقط ولا تحدّث حالة المقابلة في قاعدة البيانات
2. **عند حدوث خطأ أثناء المقابلة**: إذا فشل الاتصال أو حدث crash، تبقى المقابلة `in_progress` للأبد
3. **نفس المشكلة في `useInterviewSession.ts`**: لا يوجد cleanup عند unmount

## الحل

### 1. `src/hooks/useLiveInterview.ts` — تحديث الحالة عند unmount
في دالة cleanup (سطر 656-667)، نضيف تحديث حالة المقابلة إلى `abandoned` أو `completed` إذا كانت لا تزال `in_progress`:

```typescript
useEffect(() => {
  return () => {
    activeRef.current = false;
    stoppedManuallyRef.current = true;
    // Stop media...
    
    // Mark interview as abandoned if still in progress
    const id = interviewIdRef.current;
    if (id && !completedRef.current) {
      supabase.from("interviews")
        .update({ status: "completed" as any })
        .eq("id", id)
        .then(() => {});
    }
  };
}, []);
```

### 2. `src/hooks/useInterviewSession.ts` — نفس المعالجة
إضافة cleanup مماثل عند unmount لتحديث حالة المقابلة النصية.

### 3. تنظيف البيانات الحالية
تحديث المقابلات الـ 13 العالقة بحالة `in_progress` إلى `completed`.

### 4. إضافة `interviewIdRef` و `completedRef`
لأن cleanup يحتاج الوصول لـ `interviewId` و `isCompleted` بدون أن تكون في dependency array، نستخدم refs.

**الملفات المعدّلة:** `useLiveInterview.ts`، `useInterviewSession.ts`

