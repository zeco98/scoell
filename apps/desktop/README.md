# منارة — تطبيق Windows (Tauri 2)

يغلّف `apps/web` في نافذة أصلية بهوية منارة، مع حفظ حالة النافذة، إشعارات ويندوز،
بنية تحديث تلقائي، خزنة آمنة للـ tokens، وSQLite للعمل دون اتصال.

## حالة المرحلة

| البند | الحالة |
|---|---|
| هيكل Tauri 2 كامل (config + Rust + capabilities) | ✅ جاهز |
| نافذة 1280×800 (حد أدنى 1024×640) بعنوان عربي + حفظ الموضع/الحجم | ✅ مُهيأ |
| Installer NSIS + MSI بالعربية | ✅ مُهيأ في `tauri.conf.json` |
| بنية Auto-update (endpoint + مفتاح توقيع) | ✅ جاهزة — تحتاج توليد مفتاح |
| tokens في خزنة Stronghold (بديل localStorage) | ✅ plugin مُهيأ |
| SQLite (cache + outbox للمزامنة) | ✅ plugin مُهيأ — منطق الـ outbox يُستكمل بعد أول بناء |
| **البناء الفعلي (.exe/.msi)** | ⛔ **محجوب ببيئة الجهاز** — انظر أدناه |

## لماذا لا يوجد installer بعد؟ (قرار يعود لصاحب الجهاز)

بناء Tauri على ويندوز يتطلب أدوات غير مثبتة حاليًا على جهاز التطوير:

1. **Visual Studio Build Tools** مع حزمة **Desktop development with C++** (~7GB)
   https://visualstudio.microsoft.com/downloads/ → "Build Tools for Visual Studio"
2. **Rust (rustup)** — https://rustup.rs (~1.5GB مع toolchain MSVC)
   ```powershell
   winget install Rustlang.Rustup
   rustup default stable-msvc
   ```

بعد تثبيتهما:

```powershell
pnpm install                       # يثبت @tauri-apps/cli
cd apps/desktop
pnpm tauri icon path\to\manarah-1024.png   # توليد الأيقونات من شعار منارة
pnpm dev                           # تشغيل تطويري (يشغّل vite تلقائيًا)
pnpm build                         # ينتج NSIS setup.exe + .msi في src-tauri/target/release/bundle/
```

انسخ الناتج إلى `releases/` في جذر المستودع.

## خطوات ما بعد أول بناء (مخطط لها في الكود)

- **Offline-first:** جداول SQLite (`cache_*` للقراءة + `outbox` للتحضير والسندات)،
  مزامنة عند عودة الاتصال بسياسة «آخر كتابة تفوز» + سجل تعارضات، ومؤشر حالة في الـ Topbar.
  طبقة `TokenStore` في `@manarah/api-client` مصممة لتُستبدل بخزنة Stronghold هنا دون تغيير أي شاشة.
- **الطباعة الأصلية:** قوالب السند (A5) والكشف (A4) تأتي من الـ API جاهزة —
  نافذة الطباعة تستدعي `window.print()` وستُربط بأمر Tauri للطباعة الصامتة على الطابعة الافتراضية.
- **System tray:** أيقونة منارة + إغلاق للـ tray (خيار) + إشعارات النظام عبر `tauri-plugin-notification`.

## التوقيع الرقمي (Code Signing) — خطوة مستقبلية موثقة

1. شراء شهادة EV/OV Code Signing (Sectigo/DigiCert).
2. `tauri.conf.json → bundle.windows.certificateThumbprint` + `signCommand` عبر `signtool.exe`.
3. توقيع مفتاح الـ updater: `pnpm tauri signer generate` وتحديث `plugins.updater.pubkey`.
4. بدون توقيع، سيُظهر SmartScreen تحذيرًا عند أول تثبيت — سلوك متوقع للنسخ التجريبية.
