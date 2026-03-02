

## خطة: عرض الوظائف المتاحة في وضع التدريب بناءً على ملف المرشح

### الفكرة
حالياً `JobSelector` يعرض قائمة الوظائف من `system_settings.job_positions` (ثابتة للجميع). المطلوب: في وضع التدريب، يتم جلب ملف المرشح (المهارات، التخصص، الخبرة) ومطابقتها مع الوظائف الشاغرة النشطة (`job_vacancies`) لعرض الوظائف الأنسب له مع نسبة التوافق.

### التعديلات

| الملف | التغيير |
|-------|---------|
| `src/components/interview/JobSelector.tsx` | إضافة prop اختياري `isPractice`. عند تفعيله: جلب بيانات المرشح من `profiles` + الوظائف النشطة من `job_vacancies`، ومطابقة المهارات مع المتطلبات لحساب نسبة توافق، وعرض الوظائف مرتبة بالتوافق مع بادج النسبة. مع الإبقاء على خيار عرض "جميع الوظائف" كـ fallback |
| `src/components/training/TrainingSection.tsx` | تمرير `isPractice={true}` في روابط التدريب (إضافة query param `practice=true` موجود بالفعل) |
| `src/pages/VoiceInterview.tsx` | قراءة `practice` من searchParams وتمريره كـ prop لـ `JobSelector` |
| `src/pages/VideoInterview.tsx` | نفس التعديل |
| `src/pages/TextInterview.tsx` | نفس التعديل |

### منطق المطابقة (داخل JobSelector)
```text
1. جلب profile.resume_skills + profile.major
2. جلب job_vacancies (is_active = true)
3. لكل وظيفة: مقارنة requirements مع resume_skills
   → حساب نسبة التوافق (عدد المهارات المطابقة / إجمالي المتطلبات × 100)
4. ترتيب حسب النسبة تنازلياً
5. عرض الوظائف مع بادج النسبة (مثلاً: "تطابق ٧٥٪")
6. إذا لم توجد وظائف شاغرة → fallback إلى settings.job_positions
```

### واجهة المستخدم
- كل زر وظيفة يعرض اسم الوظيفة + القسم + بادج نسبة التوافق
- لون البادج: أخضر (≥70%)، أصفر (40-69%)، رمادي (<40%)
- زر إضافي "عرض جميع الوظائف" للتبديل بين الوظائف المقترحة والقائمة الكاملة

