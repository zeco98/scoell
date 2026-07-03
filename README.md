# منارة (Manarah) — منصة إدارة المدارس والمعاهد

منتج متعدد المنصات بهوية عربية RTL كاملة: **API** (NestJS + Prisma) · **ويب إداري** (React 18 + Vite + Tailwind v4)
· **ويندوز** (Tauri 2) · **موبايل** (Flutter). Monorepo بـ pnpm workspaces.

## تشغيل مطوّر جديد خلال دقائق

```powershell
# المتطلبات: Node 20+ وpnpm 9+ (وFlutter لمن يريد الموبايل)
pnpm install

# 1) قاعدة البيانات (SQLite للتطوير) + البيانات التجريبية
cd apps/api
pnpm exec prisma db push
pnpm seed

# 2) الـ API — http://localhost:3001/api (توثيق Swagger على /api/docs)
pnpm exec nest build; node dist/main.js

# 3) الويب (طرفية ثانية، من الجذر) — http://localhost:5173
pnpm dev
```

- الموبايل: انظر [apps/mobile/README.md](apps/mobile/README.md) — ‏APK جاهز في `releases/`.
- ويندوز: انظر [apps/desktop/README.md](apps/desktop/README.md).
- للإنتاج بـ PostgreSQL: `docker-compose.yml` (بدّل provider في `prisma/schema.prisma` إلى postgresql).

## الحسابات التجريبية (الأدوار التسعة) — كلمة المرور الموحدة: `Manarah@2026`

| الدور | البريد |
|---|---|
| المدير العام (المنصة) | super@manarah.io |
| مدير المدرسة | admin@alnoor.edu |
| المحاسب | acc@alnoor.edu |
| المعلّم | teacher@alnoor.edu |
| وليّ الأمر | parent@alnoor.edu |
| الطالب | student@alnoor.edu |
| السائق | driver@alnoor.edu |
| الموارد البشرية | hr@alnoor.edu |
| المدقّق (المنصة) | audit@manarah.io |

> إنتاجيًا: غيّر `SEED_PASSWORD` وفعّل `mustChangePassword` — انظر `apps/api/.env.example`.

## بنية المستودع

```
apps/api        NestJS + Prisma: مصادقة argon2/JWT/refresh rotation، عزل مستأجرين،
                تدقيق مركزي before/after، سندات بترقيم تسلسلي، Swagger، seed عربي
apps/web        الواجهة الإدارية: Router v7 + guards، TanStack Query، صفر أزرار ميتة
apps/desktop    Tauri 2 (هيكل كامل — البناء يتطلب Rust + VS Build Tools)
apps/mobile     Flutter: ولي الأمر/المعلم/الطالب + بصمة (APK في releases/)
packages/shared الأدوار والأنواع ومخططات zod المشتركة (مصدر الحقيقة)
packages/api-client  SDK موحّد بتجديد تلقائي يستهلكه الويب وسطح المكتب
prisma/         schema + dev.db · docs/INVENTORY.md جرد «صفر عناصر ميتة»
```

## الاختبارات والفحوص

```powershell
pnpm --filter @manarah/api exec jest      # 8 اختبارات e2e: auth، RBAC، عزل، سندات، تدقيق، refresh، قفل
node scripts/check-dead-buttons.mjs        # فحص «صفر أزرار ميتة» الآلي
cd apps/mobile; flutter test               # اختبارات widget
```
