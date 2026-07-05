import { createHmac } from "crypto";

// ============================================================================
// أمان الوثائق الرسمية: رقم تسلسلي فريد + رمز تحقق HMAC لمنع التزوير.
// الرمز يُحسب من حقول الوثية الثابتة بسرّ الخادم، ويُعاد حسابه عند التحقق —
// أي تعديل في الاسم/المعدل/السنة يُبطل الرمز. لا يُخزَّن الرمز، بل يُشتق حتميًا.
// ============================================================================

function secret(): string {
  return process.env.DOC_SIGNING_SECRET || process.env.JWT_SECRET || "manarah-doc-dev-secret";
}

const KIND_PREFIX: Record<string, string> = {
  certificate: "CRT",
  transcript: "TRN",
  report_card: "RPT",
  statement: "STM",
  receipt: "RCP",
};

/** رقم تسلسلي حتمي لوثيقة طالب في عام: CRT-<tenant6>-<student6>-<year> */
export function documentSerial(kind: string, tenantId: string, studentId: string, scope: string): string {
  const prefix = KIND_PREFIX[kind] ?? "DOC";
  const t = tenantId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  const s = studentId.replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  const sc = scope.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  return `${prefix}-${t}-${s}-${sc}`;
}

/** رمز تحقق HMAC مُنسَّق XXXX-XXXX-XXXX من الحقول الثابتة للوثيقة */
export function verificationCode(serial: string, payload: Record<string, string | number | null | undefined>): string {
  const canonical = serial + "|" + Object.keys(payload).sort().map((k) => `${k}=${payload[k] ?? ""}`).join("|");
  const hex = createHmac("sha256", secret()).update(canonical).digest("hex").slice(0, 12).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** يتحقق أن رمزًا مُقدَّمًا يطابق الحقول — لنقطة التحقق العامة */
export function isValidCode(code: string, serial: string, payload: Record<string, string | number | null | undefined>): boolean {
  const expected = verificationCode(serial, payload);
  const a = Buffer.from(expected);
  const b = Buffer.from((code || "").toUpperCase());
  if (a.length !== b.length) return false;
  // مقارنة زمن-ثابت
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
