

## تحويل TTS إلى ElevenLabs بصوت عربي سعودي

الدالة الحالية تستخدم OpenAI TTS. سنحولها لاستخدام ElevenLabs API مع مفتاح `ELEVENLABS_API_KEY` الموجود بالفعل.

| الملف | التعديل |
|-------|---------|
| `supabase/functions/elevenlabs-tts/index.ts` | استبدال OpenAI API بـ ElevenLabs API |

### التفاصيل

- استخدام نموذج `eleven_multilingual_v2` (أفضل جودة للعربية)
- استخدام صوت **River** (`SAz9YHcvj6GT2YYXdXww`) — صوت ذكوري طبيعي يدعم العربية
- استخدام `ELEVENLABS_API_KEY` بدلاً من `OPENAI_API_KEY`
- الاستجابة تبقى `audio/mpeg` — لا تغيير في الكود الأمامي (`useLiveInterview.ts`)
- تمرير `output_format` كـ query parameter (حسب متطلبات ElevenLabs API)

