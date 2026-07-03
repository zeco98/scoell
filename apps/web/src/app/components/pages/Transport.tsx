import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../auth/AuthProvider";
import { PageHeader, SectionCard, EmptyState } from "../shared";
import { Skeleton } from "../ui/skeleton";
import { Bus, Phone, MapPin } from "lucide-react";

export function Transport() {
  const { user } = useAuth();
  const isDriver = user?.role === "DRIVER";

  const { data: routes, isLoading } = useQuery({
    queryKey: ["routes", isDriver ? "mine" : "all"],
    queryFn: () => (isDriver ? api.transport.mine() : api.transport.list()),
  });

  return (
    <div>
      <PageHeader
        title="النقل المدرسي"
        subtitle={isDriver ? "مساراتك وطلابك — تحضير الركوب في الإصدارات القادمة" : "مسارات النقل والسائقون"}
      />

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      ) : (routes ?? []).length === 0 ? (
        <SectionCard title="المسارات">
          <EmptyState icon={Bus} title="لا مسارات بعد" hint={isDriver ? "لم يُسند إليك مسار — راجع إدارة المدرسة." : "أنشئ المسارات من إدارة المؤسسة."} />
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(routes ?? []).map((r) => (
            <SectionCard
              key={r.id}
              title={r.name}
              action={
                r.driver ? (
                  <span className="text-muted-foreground flex items-center gap-1.5"><Bus size={15} /> {r.driver.name}</span>
                ) : (
                  <span className="text-warning">بلا سائق</span>
                )
              }
            >
              {r.students && r.students.length > 0 ? (
                <div className="divide-y divide-border">
                  {r.students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 py-2.5 flex-wrap">
                      <span className="text-muted-foreground w-5">{i + 1}</span>
                      <div className="size-8 rounded-full bg-brand-soft text-brand flex items-center justify-center">{s.name.charAt(0)}</div>
                      <div className="flex-1 min-w-32">
                        <div className="text-foreground">{s.name}</div>
                        <div className="text-muted-foreground flex items-center gap-1">
                          <MapPin size={12} /> {s.address ?? "عنوان غير مسجّل"} · {s.section ? `${s.section.stage}/${s.section.name}` : ""}
                        </div>
                      </div>
                      <a href={`tel:${s.guardianPhone}`} className="text-brand flex items-center gap-1 hover:underline" dir="ltr">
                        <Phone size={14} /> {s.guardianPhone}
                      </a>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground py-3">
                  {r._count ? `${r._count.students} طالب مسجّل على المسار.` : "لا طلاب على هذا المسار بعد."}
                </p>
              )}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
