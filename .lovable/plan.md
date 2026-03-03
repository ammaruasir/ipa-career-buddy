

## إعادة ضبط وحذف سجلات المرشح مروان

### المرشح
- **الاسم**: Marwan
- **البريد**: marwan@gmail.com  
- **المعرف**: `38484d9e-88ce-4af4-8743-e5b0c7a8c0cc`
- **عدد المقابلات**: 14 مقابلة

### التعديل المطلوب

**ملف: `supabase/functions/manage-user/index.ts`**

إضافة action جديد `reset_candidate` يحذف جميع سجلات المرشح مع الإبقاء على الحساب:

1. جلب كل معرفات المقابلات للمستخدم
2. حذف السجلات الفرعية أولاً: `cheat_events` → `hr_notes` → `responses` → `evaluations`
3. حذف `job_applications` و `notifications`
4. حذف `interviews`

بعد النشر، سيتم استدعاء الـ function مباشرة لحذف سجلات مروان.

| الملف | التعديل |
|-------|---------|
| `supabase/functions/manage-user/index.ts` | إضافة action `reset_candidate` لحذف جميع السجلات دون حذف الحساب |
| استدعاء مباشر | تنفيذ `reset_candidate` على معرف مروان بعد النشر |

