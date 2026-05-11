import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Toast = {
  id: string;
  message: string;
  // Action callback for the toast's primary affordance. Most toasts use this
  // as a "Retry" — re-issue the failed mutation. The delete flow re-uses it
  // for "Undo" (cancel the pending DELETE). The visible button label comes
  // from `actionLabel`; falls back to "Retry" so existing call sites keep
  // working without change.
  onRetry?: () => void;
  actionLabel?: string;
};

type ToastContextValue = {
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  toasts: Toast[];
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = `t-${++toastSeq}`;
      setToasts((prev) => [...prev, { id, ...toast }]);
      return id;
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toasts,
  dismiss,
}: {
  toasts: Toast[];
  dismiss: (id: string) => void;
}): JSX.Element {
  return (
    <div role="status" aria-live="polite" className="toast-host">
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}): JSX.Element {
  const [paused, setPaused] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (paused) return;
    timer.current = window.setTimeout(onDismiss, 5000);
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, [paused, onDismiss]);

  return (
    <div
      role={toast.onRetry ? "alert" : "status"}
      className="toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{toast.message}</span>
      {toast.onRetry && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            toast.onRetry?.();
            onDismiss();
          }}
        >
          {toast.actionLabel ?? "Retry"}
        </button>
      )}
      <button
        type="button"
        className="toast-dismiss"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}
