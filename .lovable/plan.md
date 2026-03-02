

## Fix: تنقل الإشعارات حسب نوعها

حالياً `handleClick` يتعامل فقط مع نوع `evaluation_complete`. الأنواع الأخرى (`new_application`, `status_update`) لا تنقل لأي مكان.

### التغيير في `src/components/NotificationBell.tsx`

تحديث دالة `handleClick` لتشمل جميع أنواع الإشعارات:

```typescript
const handleClick = (n: Notification) => {
  markAsRead(n.id);
  if (n.related_id) {
    switch (n.type) {
      case "evaluation_complete":
        navigate(`/interview/${n.related_id}/results`);
        break;
      case "new_application":
        navigate(`/dashboard/admin/candidate/${n.related_id}`);
        break;
      case "status_update":
        navigate(`/interview/${n.related_id}/results`);
        break;
    }
  }
  setOpen(false);
};
```

- `evaluation_complete` → صفحة نتائج المقابلة (كما هو)
- `new_application` → صفحة تفاصيل المرشح
- `status_update` → صفحة نتائج المقابلة

**ملف واحد فقط**: `src/components/NotificationBell.tsx`

