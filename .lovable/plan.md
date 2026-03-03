

## المشكلة

التسجيل الحالي يأخذ فقط `videoStreamRef.current` (كاميرا + ميكروفون المرشح). صوت المحاور الذكي يُشغّل عبر `new Audio(audioUrl)` منفصلاً — لا يدخل في الـ MediaStream المسجّل.

## الحل: دمج صوت المحاور في التسجيل

### الفكرة
استخدام `AudioContext.createMediaStreamDestination()` لإنشاء stream مدمج يجمع:
1. صوت المرشح (من الميكروفون)
2. صوت المحاور (من TTS audio element)
3. فيديو المرشح (في وضع الفيديو)

### التعديلات

| الملف | التعديل |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | 1. إنشاء `mixedAudioDestRef` عبر `AudioContext.createMediaStreamDestination()` عند بدء المقابلة |
| | 2. توصيل ميكروفون المرشح بالـ destination |
| | 3. في `speakText`: توصيل TTS audio element بنفس الـ destination عبر `createMediaElementSource()` |
| | 4. استخدام الـ mixed stream (audio tracks من destination + video track من الكاميرا) كمصدر للـ `sessionRecorder` بدلاً من `videoStreamRef` مباشرة |

### التدفق الجديد
```text
ميكروفون المرشح ──┐
                   ├──→ AudioContext.destination ──→ Mixed MediaStream ──→ MediaRecorder
صوت TTS المحاور ───┘                                    + video track
```

### ملاحظة تقنية
- `createMediaElementSource()` يُستخدم مرة واحدة لكل Audio element — لذا يجب إنشاء الاتصال في كل استدعاء لـ `speakText`
- الـ Audio element يظل يُسمع عبر السماعات لأن الـ destination لا يمنع الإخراج الافتراضي (نحتاج توصيله بـ `ctx.destination` أيضاً ليُسمع)

