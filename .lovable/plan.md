## خطة: إضافة صفحة إكمال الملف الشخصي بعد التسجيل + رفع السيرة الذاتية

### الوضع الحالي

- عند التسجيل يُطلب فقط: الاسم، البريد، كلمة المرور
- جدول `profiles` يحتوي على: `full_name`, `phone`, `major`, `gpa`, `avatar_url`, `branch_location`
- لا توجد حقول لتاريخ الميلاد، الجنس، المستوى التعليمي، سنوات الخبرة، أو السيرة الذاتية
- لا يوجد فحص لاكتمال الملف الشخصي — المستخدم يدخل مباشرة للوحة التحكم

### ما سيتم بناؤه

**1. إضافة أعمدة جديدة لجدول `profiles**`

- `date_of_birth` (date)
- `gender` (text) — ذكر/أنثى
- `education_level` (text) — ثانوي/دبلوم/بكالوريوس/ماجستير/دكتوراه
- `experience_years` (integer) — سنوات الخبرة
- `nationality` (drop down menu_translated to arabic)
- `city` (drop down after nationality selection according to the nationality )
- `resume_url` (text) — رابط ملف السيرة الذاتية
- `resume_skills` (jsonb) — المهارات المستخرجة من السيرة
- `profile_completed` (boolean, default false) — علامة اكتمال الملف

**2. إنشاء storage bucket `resumes**`

- خاص (ليس عام) مع RLS: المستخدم يرفع في مجلده فقط

**3. إنشاء صفحة إكمال الملف الشخصي `/complete-profile**`

- تظهر بعد التسجيل الأول فقط (عندما `profile_completed = false`)
- خطوتين:
  - **الخطوة 1**: البيانات الشخصية (الاسم الكامل، تاريخ الميلاد، الجنس، الجنسية، المدينة، رقم الهاتف، المستوى التعليمي، التخصص، المعدل، سنوات الخبرة)
  - **الخطوة 2**: رفع السيرة الذاتية (PDF) + عرض حالة الرفع
- بعد الإكمال يتم تحديث `profile_completed = true` والتوجيه للوحة التحكم

**4. تعديل `DashboardRouter**`

- إذا كان `profile_completed = false` ← توجيه إلى `/complete-profile` بدل لوحة التحكم

**5. تحديث `ProfileSettings**`

- إضافة الحقول الجديدة (تاريخ الميلاد، الجنس، المستوى التعليمي، إلخ)
- إضافة قسم رفع/تحديث السيرة الذاتية

### الملفات المتأثرة

- **Migration**: إضافة 9 أعمدة لـ `profiles` + إنشاء bucket `resumes` + RLS
- **جديد**: `src/pages/CompleteProfile.tsx`
- **تعديل**: `src/App.tsx` (إضافة route)
- **تعديل**: `src/pages/DashboardRouter.tsx` (فحص اكتمال الملف)
- **تعديل**: `src/pages/ProfileSettings.tsx` (إضافة الحقول الجديدة + السيرة)