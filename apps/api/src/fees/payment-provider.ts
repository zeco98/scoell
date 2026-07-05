import { Injectable, Logger } from "@nestjs/common";
import { createHmac } from "crypto";

// ============================================================================
// تجريد بوابات الدفع الإلكتروني العراقية (زين كاش/آسيا حوالة/فاست باي/Qi).
// التنفيذ الحالي محاكاة (Stub) بلا مفاتيح خارجية — يولّد رابط checkout محليًا
// وتوقيعًا قابلًا للتحقق. للربط الفعلي: نفّذ PaymentProvider بـ SDK المزوّد
// (ZainCash يستخدم JWT موقّع + redirect) واستبدل الـ provider دون تغيير المستهلك.
//
// دورة الحياة: createCheckout → المستخدم يدفع في البوابة → البوابة تستدعي
// callback الخادم بـ providerRef + توقيع → verifySignature → تأكيد النية → سند.
// ============================================================================

export interface CheckoutRequest {
  providerRef: string; // مرجع النية عندنا (يُمرَّر للبوابة ويعود في الـ callback)
  amount: number;
  gateway: string;
  studentName: string;
  description: string;
  baseUrl: string; // أصل الخادم لبناء رابط العودة/المحاكاة
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerTxnId: string;
}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  /** يتحقق أن الـ callback أصيل (توقيع HMAC للمرجع بسرّ المزوّد) */
  verifySignature(providerRef: string, signature: string): boolean;
  /** توقيع مرجع — يُستخدم في المحاكاة لتوليد callback صحيح */
  sign(providerRef: string): string;
}

function gatewaySecret(): string {
  return process.env.PAYMENT_GATEWAY_SECRET || process.env.JWT_SECRET || "manarah-pay-dev-secret";
}

/**
 * محاكاة زين كاش — تولّد صفحة بوابة محلية (mock-gateway) بها زر تأكيد،
 * وتوقّع المرجع بـ HMAC يتحقق منه الخادم عند الـ callback. جاهزة للاستبدال
 * بـ ZainCash الحقيقي (JWT + https://api.zaincash.iq/transaction/init).
 */
@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  readonly name = "stub";
  private readonly logger = new Logger("PaymentGateway");

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const providerTxnId = `TXN-${Date.now()}-${req.providerRef.slice(-6)}`;
    // في الإنتاج: هذا رابط بوابة المزوّد؛ في المحاكاة صفحة داخلية بزر تأكيد
    const checkoutUrl = `${req.baseUrl}/api/payments/gateway/${encodeURIComponent(req.providerRef)}`;
    this.logger.log(`[${req.gateway}] checkout ${req.amount} د.ع — ${req.studentName} (${providerTxnId})`);
    return { checkoutUrl, providerTxnId };
  }

  sign(providerRef: string): string {
    return createHmac("sha256", gatewaySecret()).update(providerRef).digest("hex").slice(0, 32);
  }

  verifySignature(providerRef: string, signature: string): boolean {
    const expected = this.sign(providerRef);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature || "");
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }
}

const GATEWAY_LABELS: Record<string, string> = {
  zaincash: "زين كاش",
  asiahawala: "آسيا حوالة",
  fastpay: "فاست باي",
  qi: "Qi",
};

/**
 * صفحة بوابة الدفع المحاكاة — تُحاكي واجهة زين كاش: تعرض المبلغ وزرَّي تأكيد/إلغاء
 * يستدعيان callback الخادم بالتوقيع الصحيح. تُستبدَل بصفحة المزوّد الحقيقي (redirect).
 */
export function renderGatewayPage(p: {
  providerRef: string;
  signature: string;
  amount: number;
  gateway: string;
  studentName: string;
  baseUrl: string;
  done: boolean;
  status: string;
}): string {
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const amountFmt = new Intl.NumberFormat("en-US").format(p.amount) + " د.ع";
  const cb = `${p.baseUrl}/api/payments/callback`;
  const statusLabelAr: Record<string, string> = { confirmed: "تم الدفع بنجاح ✓", failed: "فشل الدفع", expired: "انتهت الصلاحية" };
  const doneBlock = p.done
    ? `<div class="done">${esc(statusLabelAr[p.status] ?? p.status)}</div>`
    : `<div class="row"><button class="pay" onclick="finish('paid')">تأكيد الدفع</button><button class="cancel" onclick="finish('failed')">إلغاء</button></div>`;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>بوابة الدفع — ${esc(GATEWAY_LABELS[p.gateway] ?? p.gateway)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet"/>
<style>
  body{font-family:Cairo,sans-serif;background:#0b6e63;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px}
  .card{background:#fff;border-radius:18px;max-width:380px;width:100%;padding:28px;box-shadow:0 12px 40px rgba(0,0,0,.25);text-align:center}
  .g{font-weight:800;color:#0b6e63;font-size:20px;margin-bottom:4px}
  .sub{color:#64748b;font-size:13px;margin-bottom:18px}
  .amount{font-size:34px;font-weight:800;color:#095a51;margin:14px 0}
  .name{color:#334155;margin-bottom:20px}
  .row{display:flex;gap:10px}
  button{flex:1;font-family:inherit;font-weight:700;font-size:15px;border:0;border-radius:12px;padding:14px;cursor:pointer}
  .pay{background:#0b6e63;color:#fff}
  .cancel{background:#f1f5f9;color:#475569}
  .done{font-size:18px;font-weight:800;color:#0b6e63;padding:16px;background:#e7f2f0;border-radius:12px}
  .note{margin-top:16px;color:#94a3b8;font-size:11px}
</style></head><body>
<div class="card">
  <div class="g">${esc(GATEWAY_LABELS[p.gateway] ?? p.gateway)}</div>
  <div class="sub">بوابة دفع تجريبية — منصة منارة</div>
  <div class="amount">${amountFmt}</div>
  <div class="name">دفع قسط: ${esc(p.studentName)}</div>
  ${doneBlock}
  <div class="note">بيئة محاكاة — تُستبدل بالبوابة الفعلية عند الربط.</div>
</div>
<script>
async function finish(outcome){
  document.querySelector('.row').innerHTML='<div style="color:#64748b">جارٍ المعالجة…</div>';
  try{
    const r=await fetch(${JSON.stringify(cb)},{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({providerRef:${JSON.stringify(p.providerRef)},signature:${JSON.stringify(p.signature)},outcome})});
    const d=await r.json();
    location.reload();
  }catch(e){ alert('تعذّر إتمام العملية'); }
}
</script>
</body></html>`;
}
