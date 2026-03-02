## خطة إضافة Vapi.ai للمقابلات المباشرة مع الحفاظ على النظام الحالي

### الفكرة العامة

إضافة وضع مقابلة مباشرة (Real-time) باستخدام Vapi.ai كخيار بديل للنظام الحالي، مع زر تبديل في إعدادات الأدمن للاختيار بين النظامين.

---

### المتطلبات الخارجية (قبل البدء)

- **VAPI_PUBLIC_KEY**: مفتاح Vapi العام (من لوحة تحكم Vapi) : this vapi public ley from my dashboard (df962df1-8da5-4ccf-b18c-eec9c2598b40)
- إنشاء **Assistant** في لوحة Vapi مع system prompt للمقابلة العربية وربطه بصوت عربي

---

### التغييرات المطلوبة

#### 1. إضافة عمود `interview_engine` لجدول `system_settings`

- عمود جديد `interview_engine` من نوع `text` بقيمة افتراضية `'built_in'`
- القيم المسموحة: `built_in` (النظام الحالي) أو `vapi` (Vapi.ai)

#### 2. تحديث `useSystemSettings` hook

- إضافة حقل `interview_engine` للـ interface والقيم الافتراضية

#### 3. إضافة زر التبديل في صفحة `AdminSettings`

- في تبويب "إعدادات المقابلة": كارد جديد يحتوي Switch للتبديل بين:
  - **النظام المدمج** (التسجيل → النسخ → AI → TTS)
  - **Vapi.ai** (محادثة مباشرة ثنائية الاتجاه)

#### 4. إنشاء Edge Function `vapi-token`

- تُرجع Public Key من الـ secrets لاستخدامه في الـ frontend بشكل آمن

#### 5. إنشاء hook جديد `useVapiInterview`

- يستخدم `@vapi-ai/web` SDK
- يدير اتصال WebRTC مع Vapi
- يستمع لأحداث: `speech-start`, `speech-end`, `message`, `call-end`
- يحفظ النصوص المنسوخة (transcript) في جدول `responses`
- ينشئ سجل المقابلة في `interviews` عند البدء
- يُشغّل `evaluate-interview` عند الانتهاء

#### 6. إنشاء مكون `VapiLiveInterview`

- واجهة مقابلة مباشرة: زر بدء/إنهاء المكالمة
- عرض حالة AI (يتحدث/يستمع) مع الأفاتار ثلاثي الأبعاد الموجود
- عرض النص المنسوخ في الوقت الحقيقي
- شريط تقدم للأسئلة

#### 7. تعديل صفحات المقابلة (Voice + Video)

- قراءة `settings.interview_engine` من `useSystemSettings`
- إذا كان `vapi` → عرض `VapiLiveInterview` بدلاً من الواجهة الحالية
- إذا كان `built_in` → الكود الحالي كما هو بدون تغيير

#### 8. تعديل `InterviewTypeDialog`

- إضافة بادج "مباشر" على خيار الصوت والفيديو عندما يكون Vapi مفعّل

---

### التفاصيل التقنية

**Vapi Web SDK Usage:**

```text
import Vapi from '@vapi-ai/web';

const vapi = new Vapi(PUBLIC_KEY);
vapi.start(assistantId, {
  assistantOverrides: {
    firstMessage: "مرحباً، أنا المحاور الآلي...",
    model: { messages: [{ role: "system", content: systemPrompt }] }
  }
});
vapi.on('message', (msg) => { /* save transcript */ });
vapi.on('call-end', () => { /* evaluate */ });
```

**تدفق المقابلة المباشرة:**

```text
المرشح يختار وظيفة → جلب Public Key → بدء مكالمة Vapi
    ↕ محادثة صوتية ثنائية الاتجاه (WebRTC)
    ↕ حفظ النصوص تلقائياً في responses
انتهاء المكالمة → تقييم AI → عرض النتائج
```

---

### الملفات المتأثرة

- **جديد**: `supabase/functions/vapi-token/index.ts`
- **جديد**: `src/hooks/useVapiInterview.ts`
- **جديد**: `src/components/interview/VapiLiveInterview.tsx`
- **تعديل**: `src/hooks/useSystemSettings.ts` (إضافة interview_engine)
- **تعديل**: `src/pages/AdminSettings.tsx` (إضافة switch)
- **تعديل**: `src/pages/VoiceInterview.tsx` (التبديل حسب Engine)
- **تعديل**: `src/pages/VideoInterview.tsx` (التبديل حسب Engine)
- **تعديل**: `src/components/interview/InterviewTypeDialog.tsx` (بادج "مباشر")
- **migration**: إضافة عمود `interview_engine`
- **تثبيت**: `@vapi-ai/web`