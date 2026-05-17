# سبب عدم تغيّر الصوت في وضع التدريب

## التشخيص

وضع التدريب يستخدم نفس مسار المقابلة الصوتية/المرئية (`LiveInterview` → `useLiveInterview` → `elevenlabs-tts`). الإعداد في قاعدة البيانات صحيح (`yXEnnEln9armDCyhkXcA`)، لكن الصوت المسموع لا يتطابق بسبب علتين في `src/hooks/useLiveInterview.ts`:

1. **Stale closure في `speakText`** (سطر 124-207): الدالة ملفوفة بـ `useCallback` مع dependencies `[speakWithBrowserTTS]` فقط، و`interviewerVoiceId` غير مذكور. هذا يجعلها تلتقط أول قيمة فقط ولا تتحدّث عند تغيّر الإعدادات أو بعد تحميلها.

2. **التحميل المتأخر للإعدادات**: `useSystemSettings` يبدأ بـ `DEFAULT_SETTINGS` (voice_id = `QsV9PCczMIklRM6xLPAS` — هبة منصوري) ثم يجلب القيمة الفعلية. لو ركّب `LiveInterview` قبل اكتمال الجلب (وهو الحال عادةً في التدريب لأن الانتقال سريع)، فإن `speakText` يلتقط الـ default ويبقى عليه حتى نهاية الجلسة.

النتيجة: في وضع التدريب يُسمع صوت هبة (الافتراضي) بدلاً من الصوت المُختار من لوحة الإدارة.

## الحل

### 1. `src/hooks/useLiveInterview.ts`
- استخدام `useRef` لتخزين `interviewerVoiceId` الحالي وتحديثه عبر `useEffect` كلما تغيّر، ثم قراءته داخل `speakText` من الـ ref.
- بديل أبسط: إضافة `interviewerVoiceId` لمصفوفة الـ deps في `useCallback` الخاصة بـ `speakText`. سنعتمد طريقة الـ ref لتفادي إعادة إنشاء كل الـ callbacks المعتمدة عليها.

### 2. `src/components/interview/LiveInterview.tsx`
- منع تركيب `useLiveInterview` قبل تحميل الإعدادات: إظهار loader صغير عند `settings.loading === true || !settings.id` وعدم بدء المقابلة حتى تصل القيم الفعلية من قاعدة البيانات. هذا يضمن أن `interviewerVoiceId` الذي يستقبله الـ hook هو القيمة الصحيحة من البداية.

### 3. (تنظيف بسيط) `src/hooks/useSystemSettings.ts`
- جعل القيمة الافتراضية أقل ضرراً (نفس القيمة الموجودة في قاعدة البيانات حالياً) ليس ضرورياً بعد الإصلاحين أعلاه، لكن سنبقي الحقل في الـ hook كما هو.

## الملفات المتأثرة
- `src/hooks/useLiveInterview.ts` — ref + قراءته داخل `speakText`
- `src/components/interview/LiveInterview.tsx` — Loader حتى تحميل الإعدادات

## التحقق
- فتح وضع التدريب الصوتي بعد التغيير → يجب أن يُسمع صوت `yXEnnEln9armDCyhkXcA` (Jeddawi) من السجلات.
- تبديل الصوت من لوحة الإدارة ثم بدء تدريب جديد → الصوت الجديد يُستخدم فوراً.
