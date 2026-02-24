import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-red-500 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
  };

  const styles: Record<ToastType, string> = {
    success: 'bg-white border-l-4 border-emerald-500',
    error: 'bg-white border-l-4 border-red-500',
    warning: 'bg-white border-l-4 border-amber-500',
    info: 'bg-white border-l-4 border-blue-500',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg pointer-events-auto ${styles[toast.type]}`}
            style={{ animation: 'slideIn 0.2s ease-out' }}
          >
            {icons[toast.type]}
            <p className="flex-1 text-sm text-gray-800">{toast.message}</p>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
