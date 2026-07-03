import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/button";
import { LogoMark } from "../brand/Logo";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** حاجز أخطاء عام — يمنع الشاشة البيضاء عند أي throw في الرسم */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" className="min-h-screen flex flex-col items-center justify-center text-center gap-4 p-8 bg-background">
          <LogoMark size={52} />
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle size={28} />
            <h1 className="text-foreground">حدث خطأ غير متوقع</h1>
          </div>
          <p className="text-muted-foreground max-w-sm">
            نعتذر — واجه التطبيق مشكلة. أعد تحميل الصفحة، وإن تكرر الأمر راجع الدعم الفني.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => window.location.reload()}>إعادة تحميل الصفحة</Button>
            <Button variant="outline" onClick={() => { window.location.href = "/dashboard"; }}>
              لوحة المعلومات
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
