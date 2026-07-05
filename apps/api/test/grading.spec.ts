// ============================================================================
// اختبارات وحدة لنظام درجات وزارة التربية العراقية (منطق نقي، بلا قاعدة بيانات)
// ============================================================================
import {
  PASS_MARK,
  gradeFor,
  isPass,
  generalAverage,
  finalResult,
} from "@manarah/shared";

describe("Iraqi Ministry grading", () => {
  it("gradeFor: التقديرات الرسمية عند الحدود", () => {
    expect(gradeFor(100)).toBe("امتياز");
    expect(gradeFor(90)).toBe("امتياز");
    expect(gradeFor(89)).toBe("جيد جدًا");
    expect(gradeFor(80)).toBe("جيد جدًا");
    expect(gradeFor(79)).toBe("جيد");
    expect(gradeFor(70)).toBe("جيد");
    expect(gradeFor(69)).toBe("متوسط");
    expect(gradeFor(60)).toBe("متوسط");
    expect(gradeFor(59)).toBe("مقبول");
    expect(gradeFor(50)).toBe("مقبول");
    expect(gradeFor(49)).toBe("راسب");
    expect(gradeFor(0)).toBe("راسب");
  });

  it("isPass: درجة النجاح 50", () => {
    expect(PASS_MARK).toBe(50);
    expect(isPass(50)).toBe(true);
    expect(isPass(49)).toBe(false);
  });

  it("generalAverage: المعدل العام أو null عند غياب المواد", () => {
    expect(generalAverage([])).toBeNull();
    expect(generalAverage([80, 90, 70])).toBeCloseTo(80);
    expect(generalAverage([55, 60])).toBeCloseTo(57.5);
  });

  it("finalResult: كل المواد ناجحة → ناجح", () => {
    const r = finalResult([90, 75, 60, 50]);
    expect(r.status).toBe("ناجح");
    expect(r.failedCount).toBe(0);
    expect(r.average).toBeCloseTo(68.75);
    expect(r.averageGrade).toBe("متوسط");
  });

  it("finalResult: رسوب في مادة (الدور الأول) → مكمّل", () => {
    const r = finalResult([90, 40, 60]);
    expect(r.status).toBe("مكمّل");
    expect(r.failedCount).toBe(1);
  });

  it("finalResult: رسوب في الدور الثاني → راسب", () => {
    const r = finalResult([90, 40, 60], { round: "second" });
    expect(r.status).toBe("راسب");
    expect(r.failedCount).toBe(1);
  });

  it("finalResult: تجاوز سقف الإكمال → راسب مباشرة", () => {
    const r = finalResult([40, 45, 30, 20], { maxSupplementary: 3 });
    expect(r.status).toBe("راسب");
    expect(r.failedCount).toBe(4);
  });

  it("finalResult: ضمن سقف الإكمال → مكمّل", () => {
    const r = finalResult([40, 80, 90], { maxSupplementary: 3 });
    expect(r.status).toBe("مكمّل");
  });

  it("finalResult: لا مواد → غير محدد", () => {
    const r = finalResult([]);
    expect(r.status).toBe("غير محدد");
    expect(r.average).toBeNull();
  });
});
