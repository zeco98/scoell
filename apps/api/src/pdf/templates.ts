// ============================================================================
// قوالب الطباعة الرسمية بهوية «منارة» — HTML print-ready (RTL، خط Cairo، #0b6e63)
//
// الاستراتيجية: السيرفر يبني مستندًا مضبوط المقاس، والعميل (ويب/ويندوز) يطبعه
// مباشرة أو يصدّره PDF عبر حوار الطباعة. لتوليد PDF ثنائي server-side لاحقًا:
// وصْل puppeteer/PrinceXML على هذه القوالب نفسها دون تغيير أي بنية.
//
// عناصر الأمان المدمجة: رقم تسلسلي فريد لكل وثيقة + رمز تحقق (HMAC) + علامة
// مائية + ذيل تحقق. رمز التحقق والرقم التسلسلي يُحسبان في طبقة الخدمة ويُمرّران
// هنا (القوالب عرضية بحتة، لا منطق تشفير فيها).
// ============================================================================

const BRAND = "#0b6e63";
const BRAND_STRONG = "#095a51";
const ACCENT = "#d9a441";
const INK = "#1a2b28";

function esc(s: unknown): string {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function iqd(n: number, numerals: "western" | "eastern" = "western"): string {
  const locale = numerals === "eastern" ? "ar-IQ" : "en-US";
  return new Intl.NumberFormat(locale).format(n) + " د.ع";
}

function ymd(d: Date | string): string {
  return (typeof d === "string" ? new Date(d) : d).toISOString().slice(0, 10);
}

const LOGO_SVG = `<svg width="44" height="44" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" rx="12" fill="${BRAND}"/><path d="M24 9L38 16.5V19H10V16.5L24 9Z" fill="${ACCENT}"/><rect x="14" y="21" width="4.5" height="14" rx="1.2" fill="#fff"/><rect x="21.75" y="21" width="4.5" height="14" rx="1.2" fill="#fff"/><rect x="29.5" y="21" width="4.5" height="14" rx="1.2" fill="#fff"/><rect x="10" y="37" width="28" height="3.5" rx="1.4" fill="#fff"/></svg>`;

// خاتم رسمي دائري برمجي — يظهر عند الطباعة (يُستبدل بختم المؤسسة الفعلي لاحقًا)
function officialSeal(orgName: string): string {
  return `<svg width="96" height="96" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="60" cy="60" r="56" fill="none" stroke="${BRAND}" stroke-width="2"/>
    <circle cx="60" cy="60" r="46" fill="none" stroke="${BRAND}" stroke-width="1" stroke-dasharray="2 3"/>
    <defs><path id="sealTop" d="M 60 60 m -38 0 a 38 38 0 1 1 76 0" /><path id="sealBot" d="M 60 60 m 38 0 a 38 38 0 1 1 -76 0" /></defs>
    <text font-family="Cairo, sans-serif" font-size="9" font-weight="700" fill="${BRAND}">
      <textPath href="#sealTop" startOffset="50%" text-anchor="middle">${esc(orgName).slice(0, 34)}</textPath>
    </text>
    <text font-family="Cairo, sans-serif" font-size="8" fill="${BRAND}">
      <textPath href="#sealBot" startOffset="50%" text-anchor="middle">وثيقة رسمية معتمدة</textPath>
    </text>
    <path d="M60 40 L74 47.5 V51 H46 V47.5 Z" fill="${ACCENT}"/>
    <rect x="49" y="53" width="3.5" height="12" rx="1" fill="${BRAND}"/>
    <rect x="58.25" y="53" width="3.5" height="12" rx="1" fill="${BRAND}"/>
    <rect x="67.5" y="53" width="3.5" height="12" rx="1" fill="${BRAND}"/>
    <rect x="46" y="67" width="28" height="3" rx="1.2" fill="${BRAND}"/>
  </svg>`;
}

export interface DocShellOptions {
  title: string;
  size?: "A4" | "A5" | "Letter";
  orientation?: "portrait" | "landscape";
  /** نص العلامة المائية القُطرية خلف المحتوى (فارغ = بلا علامة) */
  watermark?: string;
  /** رقم تسلسلي فريد للوثيقة يظهر في الذيل ويُستخدم للتحقق */
  serial?: string;
  /** رمز تحقق (HMAC) يُطبع في الذيل لكشف التزوير */
  verifyCode?: string;
}

function docShell(opts: DocShellOptions, body: string): string {
  const size = opts.size ?? "A4";
  const orient = opts.orientation ?? "portrait";
  const pageSize = `${size} ${orient}`;
  const watermark = opts.watermark
    ? `<div class="watermark">${esc(opts.watermark)}</div>`
    : "";
  return `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8" />
<title>${esc(opts.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet" />
<style>
  @page { size: ${pageSize}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { font-family: "Cairo", "Segoe UI", sans-serif; color: ${INK}; background: #eef1f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { position: relative; background: #fff; margin: 16px auto; box-shadow: 0 2px 14px rgba(0,0,0,.1); overflow: hidden; }
  .a4.portrait  { width: 210mm; min-height: 297mm; }
  .a4.landscape { width: 297mm; min-height: 210mm; }
  .a5.portrait  { width: 148mm; min-height: 210mm; }
  .letter.portrait { width: 216mm; min-height: 279mm; }
  .watermark { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 90px; font-weight: 900; color: ${BRAND}; opacity: .05; transform: rotate(-32deg);
    pointer-events: none; z-index: 0; white-space: nowrap; letter-spacing: 6px; }
  .layer { position: relative; z-index: 1; }
  .head { background: linear-gradient(135deg, ${BRAND}, ${BRAND_STRONG}); color: #fff; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; }
  .head .t { text-align: left; }
  .head .t .org { font-weight: 800; font-size: 16px; }
  .head .t .sub { opacity: .75; font-size: 11px; }
  .brand-name { font-weight: 800; font-size: 18px; display:flex; align-items:center; gap:10px; }
  .content { padding: 24px; }
  h2.doc-title { font-size: 18px; color: ${BRAND_STRONG}; }
  table.kv { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.kv td { padding: 9px 12px; border-bottom: 1px solid #e5eae8; font-size: 13px; }
  table.kv td.k { color: #64748b; width: 38%; }
  table.grid { width: 100%; border-collapse: collapse; margin-top: 12px; border: 1px solid #d9e2df; border-radius: 10px; overflow: hidden; }
  table.grid th { background: ${BRAND}; color: #fff; font-size: 12px; padding: 9px 8px; font-weight: 700; }
  table.grid td { padding: 8px; border-bottom: 1px solid #e9efed; font-size: 12.5px; text-align: center; }
  table.grid tr:nth-child(even) td { background: #f7faf9; }
  table.grid td.subj { text-align: right; font-weight: 600; }
  .total { background: #e7f2f0; border-radius: 10px; padding: 14px 16px; display: flex; justify-content: space-between; font-weight: 800; color: ${BRAND_STRONG}; margin-top: 14px; font-size: 15px; }
  .foot { padding: 12px 24px; color: #94a3b8; font-size: 10px; display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; }
  .foot .verify { direction: ltr; font-family: monospace; letter-spacing: 1px; }
  .stamp { margin-top: 30px; display: flex; justify-content: space-between; padding: 0 12px; font-size: 12px; color: #475569; }
  .stamp .line { margin-top: 40px; border-top: 1px solid #cbd5e1; width: 150px; text-align: center; padding-top: 4px; }
  .badge { display: inline-block; background: ${ACCENT}; color: #3d2c07; font-weight: 700; border-radius: 999px; padding: 3px 12px; font-size: 11px; }
  .print-bar { position: fixed; top: 12px; left: 12px; z-index: 99; }
  .print-bar button { font-family: inherit; background: ${BRAND}; color: #fff; border: 0; border-radius: 10px; padding: 10px 22px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
  /* شهادة رسمية — إطار زخرفي */
  .cert { padding: 0; }
  .cert-frame { margin: 10mm; border: 3px double ${BRAND}; border-radius: 8px; padding: 8mm; position: relative; min-height: calc(100% - 20mm); }
  .cert-frame::before { content: ""; position: absolute; inset: 4px; border: 1px solid ${ACCENT}; border-radius: 5px; pointer-events: none; }
  .cert-title { text-align: center; font-family: "Amiri", "Cairo", serif; font-size: 34px; font-weight: 700; color: ${BRAND_STRONG}; margin: 6px 0; }
  .cert-sub { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 10px; }
  .cert-body { text-align: center; font-size: 17px; line-height: 2.1; margin: 18px 8mm; }
  .cert-name { font-weight: 800; color: ${BRAND_STRONG}; font-size: 22px; padding: 0 6px; border-bottom: 2px solid ${ACCENT}; }
  @media print {
    .print-bar { display: none; }
    .sheet { margin: 0; box-shadow: none; }
    body { background: #fff; }
  }
</style>
</head>
<body>
<div class="print-bar"><button onclick="window.print()">🖨️ طباعة / حفظ PDF</button></div>
${body.replace("{{WATERMARK}}", watermark)}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// ذيل موحّد للوثائق الرسمية — رقم تسلسلي + رمز تحقق + تاريخ الإصدار
// ---------------------------------------------------------------------------
function officialFoot(serial?: string, verifyCode?: string): string {
  const left = verifyCode
    ? `<span class="verify">رمز التحقق: ${esc(verifyCode)}</span>`
    : `<span>${ymd(new Date())}</span>`;
  return `<div class="foot">
    <span>وثيقة صادرة إلكترونيًا من منصة منارة${serial ? ` — رقم: ${esc(serial)}` : ""}</span>
    ${left}
  </div>`;
}

const METHOD_AR: Record<string, string> = { CASH: "نقدًا", TRANSFER: "تحويل", CARD: "بطاقة" };

// ===========================================================================
// 1) سند قبض (A5) — موجود سابقًا، مُحسَّن بعلامة مائية ورمز تحقق
// ===========================================================================
export interface ReceiptModel {
  receiptNo: string;
  amount: number;
  method: string;
  note?: string | null;
  receivedBy: string;
  createdAt: Date;
  student: { name: string; code: string; section?: { stage: string; name: string } | null };
  feeRecord: { plan: string; total: number; paid: number };
  tenant: { name: string; city?: string | null };
  verifyCode?: string;
}

export function renderReceiptHtml(p: ReceiptModel): string {
  const remaining = p.feeRecord.total - p.feeRecord.paid;
  const body = `
<div class="sheet a5 portrait">
  {{WATERMARK}}
  <div class="layer">
  <div class="head">
    <div class="brand-name">${LOGO_SVG}<div>منارة<div style="font-size:10px;font-weight:400;opacity:.7">منصة إدارة المدارس والمعاهد</div></div></div>
    <div class="t"><div class="org">${esc(p.tenant.name)}</div><div class="sub">${esc(p.tenant.city ?? "")}</div></div>
  </div>
  <div class="content">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 class="doc-title">سند قبض</h2>
      <span class="badge">${esc(p.receiptNo)}</span>
    </div>
    <table class="kv">
      <tr><td class="k">الطالب</td><td>${esc(p.student.name)} (${esc(p.student.code)})</td></tr>
      <tr><td class="k">الشعبة</td><td>${p.student.section ? esc(`${p.student.section.stage} / ${p.student.section.name}`) : "—"}</td></tr>
      <tr><td class="k">خطة الدفع</td><td>${esc(p.feeRecord.plan)}</td></tr>
      <tr><td class="k">طريقة الدفع</td><td>${esc(METHOD_AR[p.method] ?? p.method)}</td></tr>
      <tr><td class="k">التاريخ</td><td>${ymd(p.createdAt)}</td></tr>
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
      <div class="line">ختم المؤسسة</div>
    </div>
  </div>
  ${officialFoot(p.receiptNo, p.verifyCode)}
  </div>
</div>`;
  return docShell(
    { title: `سند قبض ${p.receiptNo}`, size: "A5", watermark: "منارة", serial: p.receiptNo, verifyCode: p.verifyCode },
    body,
  );
}

// ===========================================================================
// 2) كشف درجات امتحان واحد (A4) — موجود سابقًا، مُحسَّن
// ===========================================================================
export interface ReportCardModel {
  tenantName: string;
  tenantCity?: string | null;
  examName: string;
  year: string;
  student: { name: string; code: string; section?: { stage: string; name: string } | null };
  rank: number;
  classSize: number;
  rows: { subject: string; monthly: number; midterm: number; finalExam: number; total: number; grade: string }[];
  average: number;
  serial?: string;
  verifyCode?: string;
  principalName?: string;
}

export function renderReportCardHtml(m: ReportCardModel): string {
  const rowsHtml = m.rows
    .map(
      (r) => `<tr>
        <td class="subj">${esc(r.subject)}</td>
        <td>${r.monthly}</td>
        <td>${r.midterm}</td>
        <td>${r.finalExam}</td>
        <td style="font-weight:700;color:${BRAND_STRONG}">${r.total}</td>
        <td>${esc(r.grade)}</td>
      </tr>`,
    )
    .join("");
  const body = `
<div class="sheet a4 portrait">
  {{WATERMARK}}
  <div class="layer">
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
    <table class="grid">
      <thead><tr>
        <th style="text-align:right">المادة</th><th>الشهري (20)</th><th>نصف السنة (30)</th><th>النهائي (50)</th><th>المجموع</th><th>التقدير</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="total"><span>المعدل العام</span><span>${m.average.toFixed(1)} / 100</span></div>
    <div class="stamp">
      <div class="line">${esc(m.principalName ?? "مدير المدرسة")}</div>
      <div class="line">الختم الرسمي</div>
    </div>
  </div>
  ${officialFoot(m.serial, m.verifyCode)}
  </div>
</div>`;
  return docShell(
    { title: `كشف درجات ${m.student.name}`, size: "A4", watermark: "منارة", serial: m.serial, verifyCode: m.verifyCode },
    body,
  );
}

// ===========================================================================
// 3) بيان الدرجات التفصيلي / Transcript (A4) — كل امتحانات العام مجمّعة
// ===========================================================================
export interface TranscriptModel {
  tenant: { name: string; city?: string | null };
  student: { name: string; code: string; section?: { stage: string; name: string } | null; enrolledAt?: string | Date | null };
  year: string;
  rows: { exam: string; subject: string; total: number; grade: string; date?: string | Date | null }[];
  cumulativeAverage: number;
  averageGrade?: string | null; // التقدير الرسمي للمعدل (امتياز/جيد جدًا…)
  resultLabel: string; // النتيجة النهائية: ناجح/مكمّل/راسب
  failedCount?: number; // عدد المواد الراسب فيها (للإكمال)
  serial?: string;
  verifyCode?: string;
  principalName?: string;
}

export function renderTranscriptHtml(m: TranscriptModel): string {
  const rowsHtml = m.rows.length
    ? m.rows
        .map(
          (r) => `<tr>
        <td class="subj">${esc(r.subject)}</td>
        <td>${esc(r.exam)}</td>
        <td style="font-weight:700;color:${BRAND_STRONG}">${r.total} / 100</td>
        <td>${esc(r.grade)}</td>
        <td>${r.date ? ymd(r.date) : "—"}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="5" style="padding:20px;color:#94a3b8">لا توجد نتائج مسجّلة لهذا العام</td></tr>`;
  const body = `
<div class="sheet a4 portrait">
  {{WATERMARK}}
  <div class="layer">
  <div class="head">
    <div class="brand-name">${LOGO_SVG}<div>منارة<div style="font-size:10px;font-weight:400;opacity:.7">منصة إدارة المدارس والمعاهد</div></div></div>
    <div class="t"><div class="org">${esc(m.tenant.name)}</div><div class="sub">بيان الدرجات — العام الدراسي ${esc(m.year)}</div></div>
  </div>
  <div class="content">
    <h2 class="doc-title" style="text-align:center;margin-bottom:6px">بيان درجات رسمي</h2>
    <table class="kv" style="margin-bottom:6px">
      <tr>
        <td class="k">اسم الطالب</td><td style="font-weight:700">${esc(m.student.name)}</td>
        <td class="k">الرقم</td><td>${esc(m.student.code)}</td>
      </tr>
      <tr>
        <td class="k">المرحلة / الشعبة</td><td>${m.student.section ? esc(`${m.student.section.stage} / ${m.student.section.name}`) : "—"}</td>
        <td class="k">تاريخ التسجيل</td><td>${m.student.enrolledAt ? ymd(m.student.enrolledAt) : "—"}</td>
      </tr>
    </table>
    <table class="grid">
      <thead><tr>
        <th style="text-align:right">المادة</th><th>الامتحان</th><th>الدرجة</th><th>التقدير</th><th>التاريخ</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="total">
      <span>النتيجة النهائية: <strong>${esc(m.resultLabel)}</strong>${
        m.resultLabel === "مكمّل" && m.failedCount ? esc(` (${m.failedCount} مادة — له دور ثانٍ)`) : ""
      }</span>
      <span>المعدل العام: ${m.cumulativeAverage.toFixed(1)} / 100${m.averageGrade ? esc(` — ${m.averageGrade}`) : ""}</span>
    </div>
    <div class="stamp">
      <div class="line">${esc(m.principalName ?? "مدير المدرسة")}</div>
      <div class="line">مسؤول شؤون الطلبة</div>
      <div class="line">الختم الرسمي</div>
    </div>
  </div>
  ${officialFoot(m.serial, m.verifyCode)}
  </div>
</div>`;
  return docShell(
    { title: `بيان درجات ${m.student.name}`, size: "A4", watermark: "منارة", serial: m.serial, verifyCode: m.verifyCode },
    body,
  );
}

// ===========================================================================
// 4) شهادة رسمية (A4 عرضية) — إتمام / تخرّج / قيد
// ===========================================================================
export interface CertificateModel {
  kind: "completion" | "graduation" | "enrollment";
  tenant: { name: string; city?: string | null };
  student: { name: string; code: string; section?: { stage: string; name: string } | null; guardianName?: string | null };
  year: string;
  average?: number | null;
  grade?: string | null;
  issuedAt: Date;
  serial?: string;
  verifyCode?: string;
  principalName?: string;
}

const CERT_TITLES: Record<CertificateModel["kind"], { title: string; verb: string }> = {
  completion: { title: "شهادة إتمام", verb: "قد أتمّ/أتمّت بنجاح متطلبات" },
  graduation: { title: "شهادة تخرّج", verb: "قد تخرّج/تخرّجت من" },
  enrollment: { title: "تأييد قيد دراسي", verb: "مقيّد/مقيّدة رسميًا في" },
};

export function renderCertificateHtml(m: CertificateModel): string {
  const t = CERT_TITLES[m.kind];
  const stageLabel = m.student.section ? `${m.student.section.stage} / ${m.student.section.name}` : "المرحلة الدراسية";
  const resultLine =
    m.kind !== "enrollment" && m.average != null
      ? `<div class="cert-sub" style="font-size:15px;margin-top:14px">بمعدل عام قدره <b style="color:${BRAND_STRONG}">${m.average.toFixed(1)} / 100</b>${m.grade ? ` — بتقدير <b>${esc(m.grade)}</b>` : ""}</div>`
      : "";
  const body = `
<div class="sheet a4 landscape cert">
  {{WATERMARK}}
  <div class="layer cert-frame">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div class="brand-name" style="color:${BRAND_STRONG}">${LOGO_SVG}<div>منارة<div style="font-size:10px;font-weight:400;color:#64748b">منصة إدارة المدارس والمعاهد</div></div></div>
      <div style="text-align:left"><div style="font-weight:800;color:${BRAND_STRONG}">${esc(m.tenant.name)}</div><div style="font-size:11px;color:#64748b">${esc(m.tenant.city ?? "")} · جمهورية العراق — وزارة التربية</div></div>
    </div>

    <div class="cert-title">${t.title}</div>
    <div class="cert-sub">تشهد إدارة ${esc(m.tenant.name)} بأن الطالب/الطالبة</div>

    <div class="cert-body">
      <span class="cert-name">${esc(m.student.name)}</span><br/>
      ${t.verb} <b>${esc(stageLabel)}</b><br/>
      للعام الدراسي <b>${esc(m.year)}</b>
    </div>
    ${resultLine}

    <div style="display:flex;align-items:flex-end;justify-content:space-between;margin:8mm 6mm 0">
      <div style="text-align:center;font-size:12px;color:#475569"><div style="margin-bottom:38px">${esc(m.principalName ?? "مدير المؤسسة")}</div><div style="border-top:1px solid #cbd5e1;padding-top:4px;width:150px">التوقيع</div></div>
      <div style="text-align:center">${officialSeal(m.tenant.name)}</div>
      <div style="text-align:center;font-size:12px;color:#475569"><div style="margin-bottom:38px">تاريخ الإصدار: ${ymd(m.issuedAt)}</div><div style="border-top:1px solid #cbd5e1;padding-top:4px;width:150px">الختم الرسمي</div></div>
    </div>

    <div style="text-align:center;margin-top:6mm;color:#94a3b8;font-size:10px">
      رقم الوثيقة: ${esc(m.serial ?? "—")} · <span style="direction:ltr;font-family:monospace">رمز التحقق: ${esc(m.verifyCode ?? "—")}</span>
    </div>
  </div>
</div>`;
  return docShell(
    { title: `${t.title} — ${m.student.name}`, size: "A4", orientation: "landscape", watermark: "نسخة رسمية", serial: m.serial, verifyCode: m.verifyCode },
    body,
  );
}

// ===========================================================================
// 5) كشف حساب مالي / فاتورة (A4) — كل الأقساط والدفعات مع رصيد جارٍ
// ===========================================================================
export interface StatementModel {
  tenant: { name: string; city?: string | null };
  student: { name: string; code: string; section?: { stage: string; name: string } | null; guardianName?: string | null };
  feeRecords: { plan: string; total: number; paid: number; dueDate: string; status: string }[];
  payments: { receiptNo: string; amount: number; method: string; createdAt: string | Date }[];
  serial?: string;
  verifyCode?: string;
  issuedAt: Date;
}

const FEE_STATUS_AR: Record<string, string> = { paid: "مسدّد", partial: "جزئي", overdue: "متأخر" };

export function renderStatementHtml(m: StatementModel): string {
  const totalDue = m.feeRecords.reduce((a, f) => a + f.total, 0);
  const totalPaid = m.feeRecords.reduce((a, f) => a + f.paid, 0);
  const balance = totalDue - totalPaid;

  const feeRows = m.feeRecords.length
    ? m.feeRecords
        .map(
          (f) => `<tr>
        <td class="subj">${esc(f.plan)}</td>
        <td>${iqd(f.total)}</td>
        <td>${iqd(f.paid)}</td>
        <td style="color:${f.total - f.paid > 0 ? "#b91c1c" : "#15803d"};font-weight:700">${iqd(f.total - f.paid)}</td>
        <td>${ymd(f.dueDate)}</td>
        <td>${esc(FEE_STATUS_AR[f.status] ?? f.status)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="padding:16px;color:#94a3b8">لا أقساط مسجّلة</td></tr>`;

  const payRows = m.payments.length
    ? m.payments
        .map(
          (p) => `<tr>
        <td class="subj">${esc(p.receiptNo)}</td>
        <td>${iqd(p.amount)}</td>
        <td>${esc(METHOD_AR[p.method] ?? p.method)}</td>
        <td>${ymd(p.createdAt)}</td>
      </tr>`,
        )
        .join("")
    : `<tr><td colspan="4" style="padding:16px;color:#94a3b8">لا دفعات مسجّلة</td></tr>`;

  const body = `
<div class="sheet a4 portrait">
  {{WATERMARK}}
  <div class="layer">
  <div class="head">
    <div class="brand-name">${LOGO_SVG}<div>منارة<div style="font-size:10px;font-weight:400;opacity:.7">منصة إدارة المدارس والمعاهد</div></div></div>
    <div class="t"><div class="org">${esc(m.tenant.name)}</div><div class="sub">كشف حساب مالي</div></div>
  </div>
  <div class="content">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 class="doc-title">كشف حساب الطالب</h2>
      <span style="color:#64748b;font-size:12px">${ymd(m.issuedAt)}</span>
    </div>
    <table class="kv">
      <tr>
        <td class="k">الطالب</td><td style="font-weight:700">${esc(m.student.name)} (${esc(m.student.code)})</td>
        <td class="k">الشعبة</td><td>${m.student.section ? esc(`${m.student.section.stage} / ${m.student.section.name}`) : "—"}</td>
      </tr>
      ${m.student.guardianName ? `<tr><td class="k">وليّ الأمر</td><td colspan="3">${esc(m.student.guardianName)}</td></tr>` : ""}
    </table>

    <h3 style="margin:14px 0 0;font-size:13px;color:${BRAND_STRONG}">الأقساط</h3>
    <table class="grid">
      <thead><tr><th style="text-align:right">الخطة</th><th>الإجمالي</th><th>المسدّد</th><th>المتبقي</th><th>الاستحقاق</th><th>الحالة</th></tr></thead>
      <tbody>${feeRows}</tbody>
    </table>

    <h3 style="margin:16px 0 0;font-size:13px;color:${BRAND_STRONG}">سندات القبض</h3>
    <table class="grid">
      <thead><tr><th style="text-align:right">رقم السند</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th></tr></thead>
      <tbody>${payRows}</tbody>
    </table>

    <div class="total"><span>الرصيد المتبقّي</span><span style="color:${balance > 0 ? "#b91c1c" : "#15803d"}">${balance > 0 ? iqd(balance) : "مسدّد بالكامل ✓"}</span></div>
    <div class="stamp">
      <div class="line">المحاسب</div>
      <div class="line">ختم المؤسسة</div>
    </div>
  </div>
  ${officialFoot(m.serial, m.verifyCode)}
  </div>
</div>`;
  return docShell(
    { title: `كشف حساب ${m.student.name}`, size: "A4", watermark: "منارة", serial: m.serial, verifyCode: m.verifyCode },
    body,
  );
}
