

## خطة: استبدال الشعار والـ Favicon بشعار معهد الإدارة العامة (IPA)

### المصدر
شعار IPA متاح على: `https://www.ipa.edu.sa/_catalogs/masterpage/ar-sa/assets/img/ipa-logo.png`

### التعديلات

**1. `index.html`** — تحديث الـ favicon ليشير لشعار IPA:
```html
<link rel="icon" href="https://www.ipa.edu.sa/_catalogs/masterpage/ar-sa/assets/img/ipa-logo.png" type="image/png">
```

**2. استبدال أيقونة Briefcase بصورة شعار IPA في جميع الصفحات:**

| الملف | الموقع |
|-------|--------|
| `src/pages/Index.tsx` | Header logo + Footer logo |
| `src/pages/Login.tsx` | شعار صفحة تسجيل الدخول (×2) |
| `src/pages/ResetPassword.tsx` | شعار صفحة إعادة التعيين |
| `src/pages/Dashboard.tsx` | Header |
| `src/pages/CandidateDashboard.tsx` | Header |
| `src/pages/AdminDashboard.tsx` | Header |
| `src/pages/HRDashboard.tsx` | Header |
| `src/pages/JobVacancies.tsx` | Header |
| `src/components/interview/JobSelector.tsx` | Header |
| `src/components/interview/InterviewHeader.tsx` | Header |

**التغيير في كل موقع:** استبدال `<Briefcase>` icon بـ `<img src="https://www.ipa.edu.sa/_catalogs/masterpage/ar-sa/assets/img/ipa-logo.png" alt="معهد الإدارة العامة">` مع الاحتفاظ بنفس الحجم والتنسيق.

