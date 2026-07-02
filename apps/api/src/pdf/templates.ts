// ============================================================================
// قوالب الطباعة بهوية «منارة» — HTML print-ready (RTL، خط Cairo، #0b6e63)
// الاستراتيجية: السيرفر يبني مستندًا مضبوط المقاس (A5 للسند، A4 للكشف)،
// والعميل (ويب/ويندوز) يطبعه مباشرة أو يصدّره PDF عبر حوار الطباعة.
// لتوليد PDF ثنائي server-side لاحقًا: وصْل puppeteer على هذه القوالب نفسها.
// ============================================================================

const BRAND = "#0b6e63";
const BRAND_STRONG = "#095a51";
const ACCENT = "#d9a441";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function iqd(n: number): string {
  return new Intl.NumberFormat("en-US").format(n) + " د.ع";
}

const LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${BRAND}"/><path d="M24 9L38 16.5V19H10V16.5L24 9Z" fill="${ACCENT}"/><rect x="14" y="21" width="4.5" height="14" rx="1.2" fill="#fff"/><rect x="21.75" y="21" width="4.5" height="14" rx="1.2" fill="#fff"/><rect x="29.5" y="21" width="4.5" height="14" rx="1.2" fill="#fff"/><rect x="10" y="37" width="28" height="3.5" rx="1.4" fill="#fff"/></svg>`;

function docShell(title: string, pageSize: string, body: string): string {
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  @page { size: ${pageSize}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: "Cairo", "Segoe UI", sans-serif; color: #1a2b28; background: #f2f4f3; }
  .sheet { background: #fff; margin: 16px auto; box-shadow: 0 2px 12px rgba(0,0,0,.08); overflow: hidden; }
  .a5 { width: 148mm; min-height: 200mm; }
  .a4 { width: 210mm; min-height: 287mm; }
  .head { background: linear-gradient(135deg, ${BRAND}, ${BRAND_STRONG}); color: #fff; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; }
  .head .t { text-align: left; }
  .head .t .org { font-weight: 800; font-size: 16px; }
  .head .t .sub { opacity: .75; font-size: 11px; }
  .brand-name { font-weight: 800; font-size: 18px; display:flex; align-items:center; gap:10px; }
  .content { padding: 24px; }
  table.kv { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.kv td { padding: 9px 12px; border-bottom: 1px solid #e5eae8; font-size: 13px; }
  table.kv td.k { color: #64748b; width: 38%; }
  .total { background: #e7f2f0; border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; font-weight: 800; color: ${BRAND_STRONG}; margin-top: 14px; font-size: 15px; }
  .foot { padding: 14px 24px; color: #94a3b8; font-size: 10.5px; display: flex; justify-content: space-between; border-top: 1px dashed #e2e8f0; }
  .stamp { margin-top: 26px; display: flex; justify-content: space-between; padding: 0 12px; font-size: 12px; color: #475569; }
  .stamp .line { margin-top: 34px; border-top: 1px solid #cbd5e1; width: 130px; text-align: center; padding-top: 4px; }
  .badge { display: inline-block; background: ${ACCENT}; color: #3d2c07; font-weight: 700; border-radius: 999px; padding: 3px 12px; font-size: 11px; }
  .print-bar { position: fixed; top: 12px; left: 12px; z-index: 9; }
  .print-bar button { font-family: inherit; background: ${BRAND}; color: #fff; border: 0; border-radius: 10px; padding: 10px 22px; font-size: 14px; font-weight: 700; cursor: pointer; }
  @media print { .print-bar { display: none; } .sheet { margin: 0; box-shadow: none; } body { background: #fff; } }
</style>
</head>
<body>
<div class="print-bar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>
${body}
</body>
</html>`;
}

interface ReceiptModel {
  receiptNo: string;
  amount: number;
  method: string;
  note?: string | null;
  receivedBy: string;
  createdAt: Date;
  student: { name: string; code: string; section?: { stage: string; name: string } | null };
  feeRecord: { plan: string; total: number; paid: number };
  tenant: { name: string; city?: string | null };
}

const METHOD_AR: Record<string, string> = { CASH: "نقدًا", TRANSFER: "تحويل", CARD: "بطاقة" };

export function renderReceiptHtml(p: ReceiptModel): string {
  const remaining = p.feeRecord.total - p.feeRecord.paid;
  const body = `
<div class="sheet a5">
  <div class="head">
    <div class="brand-name">${LOGO_SVG}<div>منارة<div style="font-size:10px;font-weight:400;opacity:.7">منصة إدارة المدارس والمعاهد</div></div></div>
    <div class="t"><div class="org">${esc(p.tenant.name)}</div><div class="sub">${esc(p.tenant.city ?? "")}</div></div>
  </div>
  <div class="content">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 style="font-size:18px;color:${BRAND_STRONG}">سند قبض</h2>
      <span class="badge">${esc(p.receiptNo)}</span>
    </div>
    <table class="kv">
      <tr><td class="k">الطالب</td><td>${esc(p.student.name)} (${esc(p.student.code)})</td></tr>
      <tr><td class="k">الشعبة</td><td>${p.student.section ? esc(`${p.student.section.stage} / ${p.student.section.name}`) : "—"}</td></tr>
      <tr><td class="k">خطة الدفع</td><td>${esc(p.feeRecord.plan)}</td></tr>
      <tr><td class="k">طريقة الدفع</td><td>${esc(METHOD_AR[p.method] ?? p.method)}</td></tr>
      <tr><td class="k">التاريخ</td><td>${p.createdAt.toISOString().slice(0, 10)}</td></tr>
      <tr><td class="k">المحصِّل</td><td>${esc(p.receivedBy)}</td></tr>
      ${p.note ? `<tr><td class="k">ملاحظة</td><td>${esc(p.note)}</td></tr>` : ""}
    </table>
    <div class="total"><span>المبلغ المقبوض</span><span>${iqd(p.amount)}</span></div>
    <table class="kv" style="margin-top:10px">
      <tr><td class="k">إجمالي الرسوم</td><td>${iqd(p.feeRecord.total)}</td></tr>
      <tr><td class="k">المسدد حتى الآن</td><td>${iqd(p.feeRecord.paid)}</td></tr>
      <tr><td class="k">المتبقي</td><td style="color:${remaining > 0 ? "#b91c1c" : "#15803d"};font-weight:700">${remaining > 0 ? iqd(remaining) : "مسدد بالكامل ✓"}</td></tr>
    </table>
    <div class="stamp">
      <div class="line">توقيع المحصِّل</div>
      <div class="line">الختم</div>
    </div>
  </div>
  <div class="foot"><span>وثيقة صادرة إلكترونيًا من منصة منارة — ${esc(p.receiptNo)}</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
</div>`;
  return docShell(`سند قبض ${p.receiptNo}`, "A5", body);
}

interface ReportCardModel {
  tenantName: string;
  examName: string;
  year: string;
  student: { name: string; code: string; section?: { stage: string; name: string } | null };
  rank: number;
  classSize: number;
  rows: { subject: string; monthly: number; midterm: number; finalExam: number; total: number; grade: string }[];
  average: number;
}

export function renderReportCardHtml(m: ReportCardModel): string {
  const rowsHtml = m.rows
    .map(
      (r) => `<tr>
        <td>${esc(r.subject)}</td>
        <td style="text-align:center">${r.monthly}</td>
        <td style="text-align:center">${r.midterm}</td>
        <td style="text-align:center">${r.finalExam}</td>
        <td style="text-align:center;font-weight:700;color:${BRAND_STRONG}">${r.total}</td>
        <td style="text-align:center">${esc(r.grade)}</td>
      </tr>`,
    )
    .join("");
  const body = `
<div class="sheet a4">
  <div class="head">
    <div class="brand-name">${LOGO_SVG}<div>منارة<div style="font-size:10px;font-weight:400;opacity:.7">منصة إدارة المدارس والمعاهد</div></div></div>
    <div class="t"><div class="org">${esc(m.tenantName)}</div><div class="sub">كشف الدرجات — ${esc(m.year)}</div></div>
  </div>
  <div class="content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div>
        <h2 style="font-size:20px;color:${BRAND_STRONG}">${esc(m.student.name)}</h2>
        <div style="color:#64748b;font-size:13px">${m.student.section ? esc(`${m.student.section.stage} / ${m.student.section.name}`) : ""} · ${esc(m.student.code)} · ${esc(m.examName)}</div>
      </div>
      <span class="badge">الترتيب ${m.rank} من ${m.classSize}</span>
    </div>
    <table class="kv" style="border:1px solid #e5eae8;border-radius:10px;overflow:hidden">
      <thead><tr style="background:#f1f5f4;font-weight:700">
        <td>المادة</td><td style="text-align:center">الشهري (20)</td><td style="text-align:center">نصف السنة (30)</td><td style="text-align:center">النهائي (50)</td><td style="text-align:center">المجموع</td><td style="text-align:center">التقدير</td>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="total"><span>المعدل العام</span><span>${m.average.toFixed(1)} / 100</span></div>
    <div class="stamp">
      <div class="line">مدير المدرسة</div>
      <div class="line">الختم الرسمي</div>
    </div>
  </div>
  <div class="foot"><span>وثيقة صادرة إلكترونيًا من منصة منارة</span><span>${new Date().toISOString().slice(0, 10)}</span></div>
</div>`;
  return docShell(`كشف درجات ${m.student.name}`, "A4", body);
}
