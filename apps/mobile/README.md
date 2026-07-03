# منارة — تطبيق الموبايل (Flutter)

تطبيق واحد بواجهات حسب الدور: **ولي الأمر** (أبناؤه، حضور اليوم، الرصيد، النتائج، الإشعارات)،
**المعلم** (تحضير سريع بنقرة لكل طالب + حفظ جماعي يُشعر أولياء الغائبين)، **الطالب** (إشعاراته).

- الهوية: ثيم مبني من tokens منارة (`lib/core/theme.dart`) + خط Cairo + RTL افتراضي.
- المعمارية: Riverpod + dio (تجديد تلقائي للـ tokens) + go_router + flutter_secure_storage.
- الدخول: بريد/كلمة مرور، و**بصمة** بعد أول دخول ناجح (جلسة refresh في التخزين الآمن).
- haptics خفيفة عند التحضير والحفظ، pull-to-refresh في القوائم.

## التشغيل

```bash
flutter pub get
# محاكي أندرويد يصل للـ API المحلي تلقائيًا عبر 10.0.2.2:3001
flutter run
# جهاز حقيقي على نفس الشبكة:
flutter run --dart-define=API_URL=http://<IP-جهازك>:3001/api
# بناء APK (الناتج يُنسخ إلى releases/ في جذر المستودع)
flutter build apk --release
flutter test
```

> ملاحظة ويندوز: مسار المشروع يحوي حروفًا عربية، لذا `android/gradle.properties`
> يتضمن `android.overridePathCheck=true`.

## Push Notifications (FCM) — خطوة موثقة

البنية جاهزة للإضافة دون تغيير معماري:
1. أنشئ مشروع Firebase وأضف `google-services.json` إلى `android/app/`.
2. `flutter pub add firebase_core firebase_messaging` + تهيئة في `main()`.
3. Backend: أضف نموذج `Device { userId, fcmToken, platform }` وendpoint
   `POST /devices` (يُستدعى بعد الدخول)، ثم وسّع `StubChannelProvider` في
   `apps/api/src/notifications` لإرسال FCM فعليًا عند إنشاء الإشعار —
   غياب الابن يصبح إشعارًا فوريًا على هاتف ولي الأمر.

## iOS — خطوة موثقة (بيئة macOS مطلوبة)

المشروع مولّد بمنصتي android,ios. للبناء: macOS + Xcode ثم
`flutter build ipa`، مع تفعيل Face ID في `Info.plist`
(`NSFaceIDUsageDescription`) — كود `local_auth` نفسه يعمل دون تعديل.
