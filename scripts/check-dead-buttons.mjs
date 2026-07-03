#!/usr/bin/env node
// فحص «صفر أزرار ميتة» (Master Prompt §3): يفشل إن وُجد onClick يستدعي
// toast فقط دون أي عملية حقيقية (mutation / استدعاء api / تنقّل / فتح نافذة).
// تشغيل: node scripts/check-dead-buttons.mjs

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..", "apps", "web", "src");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(name)) yield p;
  }
}

// يلتقط جسم الـ arrow function داخل onClick={...} مع موازنة الأقواس
function extractHandlers(src) {
  const handlers = [];
  const re = /onClick=\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    const line = src.slice(0, m.index).split("\n").length;
    handlers.push({ body: src.slice(start, i - 1), line });
  }
  return handlers;
}

// مؤشرات «عملية حقيقية» داخل المعالج أو عبر دالة مسماة (تُفحص يدويًا إن استُدعيت)
const REAL_WORK =
  /\.(mutate|mutateAsync)\(|api\.|navigate\(|window\.(open|print)|set[A-Z]\w*\(|logout\(|login\(|reset\(|invalidateQueries|Value\(|href|location\./;

let violations = 0;
let total = 0;

for (const file of walk(ROOT)) {
  const src = readFileSync(file, "utf8");
  for (const h of extractHandlers(src)) {
    total++;
    const callsToast = /toast[.(]/.test(h.body);
    const doesRealWork = REAL_WORK.test(h.body);
    // معالج يذكر toast دون أي عمل حقيقي = زر ميت
    if (callsToast && !doesRealWork) {
      violations++;
      console.error(`✗ ${relative(ROOT, file)}:${h.line} — onClick بـ toast فقط دون عملية:\n    ${h.body.trim().slice(0, 120)}`);
    }
  }
}

console.log(`\nفحص الأزرار الميتة: ${total} معالج onClick مفحوص، ${violations} مخالفة.`);
if (violations > 0) {
  console.error("❌ فشل الفحص — أزرار toast وهمية موجودة.");
  process.exit(1);
}
console.log("✅ صفر أزرار ميتة.");
