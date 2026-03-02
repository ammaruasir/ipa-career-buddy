

## الخطة: حل شامل لضمان إنهاء المقابلة وحفظ التسجيلات

### المشاكل الحالية
1. **لا يوجد حماية عند إغلاق المتصفح** — التسجيل يضيع والمقابلة تبقى `in_progress`
2. **بعد انتهاء الأسئلة، المقابلة تنتهي تلقائياً** دون تأكيد من المرشح
3. **الـ cleanup عند unmount** يحدّث الحالة فقط لكن لا يرفع التسجيل

### الحل

#### 1. إضافة `beforeunload` لمنع الإغلاق أثناء المقابلة
| الملف | التغيير |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | إضافة `useEffect` يستمع لحدث `beforeunload` عندما تكون المقابلة نشطة (`isActive`). يعرض تحذير المتصفح الأصلي "هل تريد مغادرة الصفحة؟" |
| `src/pages/TextInterview.tsx` | نفس التعديل — `beforeunload` أثناء المقابلة النشطة |

#### 2. إضافة `navigator.sendBeacon` لرفع حالة المقابلة عند الإغلاق
| الملف | التغيير |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | في `cleanup` عند الـ unmount، استخدام `navigator.sendBeacon` لإرسال طلب تحديث الحالة إلى edge function جديدة تضمن حفظ الحالة حتى لو أُغلق المتصفح |

#### 3. إنشاء edge function لتحديث حالة المقابلة
| الملف | التغيير |
|-------|---------|
| `supabase/functions/complete-interview/index.ts` | Edge function بسيطة تستقبل `interview_id` وتحدّث حالة المقابلة إلى `completed` — تستخدم مع `sendBeacon` |

#### 4. تأكيد من المرشح قبل إنهاء المقابلة عند آخر سؤال
| الملف | التغيير |
|-------|---------|
| `src/hooks/useLiveInterview.ts` | بدلاً من استدعاء `getClosingResponse()` مباشرة بعد إجابة آخر سؤال، تعيين حالة جديدة `awaitingEndConfirmation = true` |
| `src/components/interview/LiveInterview.tsx` | عرض dialog تأكيد عندما `live.awaitingEndConfirmation === true` بخيارين: "إنهاء المقابلة" (يستدعي `live.confirmEnd()`) أو "متابعة" (يستدعي `live.continueInterview()` لإضافة أسئلة إضافية) |
| `src/hooks/useLiveInterview.ts` | إضافة دالتين: `confirmEnd()` تستدعي `getClosingResponse()` ثم `endInterview()`، و `continueInterview()` تعيد `lastQuestionRef` إلى `false` وتستأنف الاستماع |

#### 5. نفس المنطق للمقابلة النصية
| الملف | التغيير |
|-------|---------|
| `src/hooks/useInterviewSession.ts` | بدلاً من إنهاء المقابلة تلقائياً عند آخر سؤال، تعيين `awaitingEndConfirmation = true` |
| `src/pages/TextInterview.tsx` | عرض dialog تأكيد مع نفس الخيارين + إضافة `beforeunload` |

### النتيجة
- **إغلاق المتصفح** → تحذير أصلي + `sendBeacon` يحفظ الحالة
- **انتهاء الأسئلة** → dialog يسأل المرشح "هل تريد إنهاء المقابلة أم المتابعة؟"
- **تأكيد الإنهاء** → كلمة وداع من المحاور الآلي → رفع التسجيل → تقييم
- **اختيار المتابعة** → أسئلة إضافية تُطرح

