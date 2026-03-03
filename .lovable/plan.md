

## التعديلات المطلوبة

### 1. تغيير الاسم من "المحاور الذكي" إلى "محاور واكب الذكي"

| الملف | التعديل |
|-------|---------|
| `src/components/interview/AIAvatarScene.tsx` | تغيير النص في سطر 34 (`alt`) وسطر 58 (التسمية) |

### 2. إزالة نافذة "متابعة أو إنهاء" — المقابلة تنتهي تلقائياً

المشكلة: عند اكتمال عدد الأسئلة، يظهر `AlertDialog` يسأل المرشح "هل تريد المتابعة أم الإنهاء؟" — هذا يجب ألا يكون خيار المرشح. بدلاً من ذلك، عند اكتمال الأسئلة التقنية، يجب أن ينتقل المحاور تلقائياً لأسئلة الختام ثم ينهي المقابلة.

| الملف | التعديل |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | في سطر 320-325: بدلاً من `setAwaitingEndConfirmation(true)`، استدعي `getClosingResponse()` مباشرة. حذف `awaitingEndConfirmation`, `confirmEnd`, `continueInterview` |
| `src/hooks/useInterviewSession.ts` | نفس التعديل: في سطر 164-169 استدعي `confirmEnd()` مباشرة بدل `setAwaitingEndConfirmation`. حذف `awaitingEndConfirmation`, `continueInterview` |
| `src/components/interview/LiveInterview.tsx` | حذف `AlertDialog` الخاص بـ `awaitingEndConfirmation` (سطر 315-333) |
| `src/pages/TextInterview.tsx` | حذف `AlertDialog` الخاص بـ `awaitingEndConfirmation` (سطر 266-282) |

### 3. جعل الجملة الافتتاحية ديناميكية (Live Interview)

| الملف | التعديل |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | سطر 730: بدلاً من رسالة ثابتة (`هلا والله! أنا أحمد...`)، استدعي `/chat` بدون رسائل سابقة ليولّد AI رسالة افتتاحية ديناميكية بناءً على الـ prompt الموجود الذي يوجهه لتنويع البداية |

### تفاصيل تقنية

**إزالة نافذة التأكيد — التدفق الجديد:**
```
الأسئلة تكتمل → lastQuestionRef = true
المرشح يجيب على آخر سؤال → 
  بدلاً من: setAwaitingEndConfirmation(true) ← يُحذف
  الجديد: getClosingResponse() ← ينتقل مباشرة لأسئلة الختام ثم ينهي المقابلة
```

**الجملة الافتتاحية الديناميكية:**
```
بدلاً من: firstMessage = "هلا والله! أنا أحمد..." (ثابت)
الجديد: استدعاء chat API بـ messages فارغة + system prompt → AI يولّد تحية مختلفة كل مرة
```

