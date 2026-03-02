

## المشكلة

عند انتهاء المقابلة، يتم تعيين `isActive = false` فوراً (سطر 459 في `useLiveInterview.ts`)، لكن `isCompleted = true` لا يتم تعيينها إلا بعد رفع التسجيل وتحديث قاعدة البيانات (سطر 529). خلال هذه الفترة الزمنية، شرط عرض زر "بدء المقابلة" يتحقق (`!isActive && !isConnecting && !isCompleted`)، فيظهر الزر مؤقتاً.

## الحل

نقل `setIsCompleted(true)` إلى بداية دالة `endInterview` مباشرة بعد `setIsActive(false)` حتى لا يظهر الزر أبداً بعد انتهاء المقابلة.

### التعديل

| الملف | التغيير |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | نقل `setIsCompleted(true)` من سطر 529 إلى بعد `setIsActive(false)` مباشرة (سطر 460). هذا يضمن إخفاء زر البدء فوراً عند بدء عملية الإنهاء |

```typescript
// في endInterview — التغيير المطلوب
setIsActive(false);
setIsCompleted(true);  // ← نقلها هنا بدلاً من سطر 529
setIsListening(false);
setIsSpeaking(false);
```

