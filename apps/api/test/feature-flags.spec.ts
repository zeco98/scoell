// ============================================================================
// اختبارات وحدة لنظام أعلام الميزات لكل مؤسسة (Feature Flags) — منطق نقي +
// FeatureGuard بمحاكاة Reflector/Prisma/ExecutionContext (بلا قاعدة بيانات حقيقية)
// ============================================================================
import { ForbiddenException } from "@nestjs/common";
import { DEFAULT_FEATURE_ENABLED, FEATURES, type FeatureKey } from "@manarah/shared";
import { resolveTenantFeatures, type AuthUser } from "../src/common/types";
import { FeatureGuard } from "../src/common/feature.guard";
import { FEATURE_KEY } from "../src/common/decorators";

describe("resolveTenantFeatures (منطق نقي)", () => {
  it("بلا صفوف محفوظة: كل المفاتيح على قيمتها الافتراضية (الكل مفعّل)", () => {
    const resolved = resolveTenantFeatures([]);
    expect(resolved).toEqual(DEFAULT_FEATURE_ENABLED);
    for (const f of FEATURES) expect(resolved[f.key]).toBe(true);
  });

  it("صف تعطيل واحد: المفتاح المعطَّل false فقط، البقية على الافتراضي", () => {
    const resolved = resolveTenantFeatures([{ key: "ATTENDANCE", enabled: false }]);
    expect(resolved.ATTENDANCE).toBe(false);
    expect(resolved.EXAMS).toBe(true);
    expect(resolved.AI_ASSISTANT).toBe(true);
    // بقية المفاتيح كلها على الافتراضي
    for (const f of FEATURES) {
      if (f.key === "ATTENDANCE") continue;
      expect(resolved[f.key]).toBe(f.defaultEnabled);
    }
  });

  it("صفوف بمفتاح غير معروف تُتجاهل بأمان ولا تُدرج في النتيجة", () => {
    const resolved = resolveTenantFeatures([
      { key: "NOT_A_REAL_FEATURE", enabled: false },
      { key: "ATTENDANCE", enabled: false },
    ] as { key: string; enabled: boolean }[]);
    expect((resolved as Record<string, boolean>)["NOT_A_REAL_FEATURE"]).toBeUndefined();
    expect(resolved.ATTENDANCE).toBe(false);
    expect(Object.keys(resolved).sort()).toEqual(FEATURES.map((f) => f.key).sort());
  });

  it("صف enabled:true صريح لا يغيّر شيئًا عن الافتراضي (كل الميزات true افتراضيًا)", () => {
    const resolved = resolveTenantFeatures([{ key: "EXAMS", enabled: true }]);
    expect(resolved).toEqual(DEFAULT_FEATURE_ENABLED);
  });
});

describe("FeatureGuard", () => {
  function makeCtx(user: AuthUser | undefined, body: Record<string, unknown> = {}, params: Record<string, unknown> = {}) {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user, body, params }),
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  function makeGuard(requiredFeature: FeatureKey | undefined, findManyResult: { key: string; enabled: boolean }[]) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredFeature) };
    const prisma = { tenantFeature: { findMany: jest.fn().mockResolvedValue(findManyResult) } };
    const guard = new FeatureGuard(prisma as any, reflector as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { guard, reflector, prisma };
  }

  const tenantUser = (role: AuthUser["role"], tenantId = "tenant-a"): AuthUser => ({
    id: "u1",
    name: "مستخدم",
    email: "u@test.io",
    role,
    tenantId,
  });

  it("بلا @Feature على المسار: يسمح فورًا دون استعلام قاعدة بيانات", async () => {
    const { guard, prisma } = makeGuard(undefined, []);
    const ctx = makeCtx(tenantUser("SCHOOL_ADMIN"));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.tenantFeature.findMany).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN (دور منصة بلا مؤسسة) يتجاوز الفحص دائمًا", async () => {
    const { guard } = makeGuard("ATTENDANCE", [{ key: "ATTENDANCE", enabled: false }]);
    const ctx = makeCtx({ id: "s1", name: "مدير", email: "s@test.io", role: "SUPER_ADMIN", tenantId: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("AUDITOR (دور منصة بلا مؤسسة) يتجاوز الفحص دائمًا", async () => {
    const { guard } = makeGuard("ATTENDANCE", [{ key: "ATTENDANCE", enabled: false }]);
    const ctx = makeCtx({ id: "a1", name: "مدقق", email: "a@test.io", role: "AUDITOR", tenantId: null });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("مستخدم مؤسسة، الميزة مفعّلة صراحة → يسمح", async () => {
    const { guard } = makeGuard("ATTENDANCE", [{ key: "ATTENDANCE", enabled: true }]);
    const ctx = makeCtx(tenantUser("TEACHER"));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("مستخدم مؤسسة، بلا أي صف محفوظ (افتراضي مفعّل) → يسمح", async () => {
    const { guard } = makeGuard("ATTENDANCE", []);
    const ctx = makeCtx(tenantUser("TEACHER"));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("مستخدم مؤسسة، الميزة معطَّلة صراحة → يرفض برسالة محددة بالضبط", async () => {
    const { guard } = makeGuard("ATTENDANCE", [{ key: "ATTENDANCE", enabled: false }]);
    const ctx = makeCtx(tenantUser("SCHOOL_ADMIN"));
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    try {
      await guard.canActivate(ctx);
      fail("كان يجب رمي ForbiddenException");
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toBe("This feature is not enabled for your school.");
    }
  });

  it("SCHOOL_ADMIN و TEACHER كلاهما يُمنع عند تعطيل الميزة — لا استثناء للأدوار المميزة داخل المؤسسة", async () => {
    const disabled = [{ key: "ATTENDANCE", enabled: false }];
    const { guard: guardAdmin } = makeGuard("ATTENDANCE", disabled);
    await expect(guardAdmin.canActivate(makeCtx(tenantUser("SCHOOL_ADMIN")))).rejects.toThrow(ForbiddenException);

    const { guard: guardTeacher } = makeGuard("ATTENDANCE", disabled);
    await expect(guardTeacher.canActivate(makeCtx(tenantUser("TEACHER")))).rejects.toThrow(ForbiddenException);
  });

  it("يحسم المؤسسة من req.user.tenantId فقط — tenantId مزوَّر في body/params لا يغيّر القرار", async () => {
    // مستخدم مؤسسة (tenant-a) والميزة معطلة له، لكنه يحقن tenantId مؤسسة أخرى في body/params
    const { guard, prisma } = makeGuard("ATTENDANCE", [{ key: "ATTENDANCE", enabled: false }]);
    const ctx = makeCtx(tenantUser("SCHOOL_ADMIN", "tenant-a"), { tenantId: "tenant-b" }, { tenantId: "tenant-b" });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    // الاستعلام استُخدم بمعرّف المستخدم الحقيقي فقط، وليس القيمة المزوَّرة
    expect(prisma.tenantFeature.findMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-a" },
      select: { key: true, enabled: true },
    });
  });

  it("عربي/RTL: التسمية العربية للميزة المعطّلة موجودة في سجل FEATURES المشترك", () => {
    const feature = FEATURES.find((f) => f.key === "ATTENDANCE");
    expect(feature?.labelAr).toBe("الحضور والغياب");
  });
});
