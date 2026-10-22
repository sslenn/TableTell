import React from 'react';
import { useToastStore, type ToastType } from '../../store/useToastStore';
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';

const iconMap: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle
};

const borderMap: Record<ToastType, string> = {
  success: '#34D399',
  info: '#38BDF8',
  warning: '#FB923C',
  error: '#F87171'
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => {
        const Icon = iconMap[t.type];
        const borderColor = borderMap[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: borderColor,
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)'
            }}
          >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: borderColor }} />
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-bold leading-tight"
                style={{ color: 'var(--tt-text-primary)' }}
              >
                {t.title}
              </div>
              {t.message && (
                <div
                  className="text-[11px] mt-0.5 leading-snug opacity-80"
                  style={{ color: 'var(--tt-text-secondary)' }}
                >
                  {t.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-muted opacity-60 hover:opacity-100 p-0.5 rounded cursor-pointer transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
