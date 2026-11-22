import React from 'react';
import { Sparkles, X, RotateCcw } from 'lucide-react';

interface CompletionModalProps {
  open: boolean;
  won: boolean;
  title: string;
  subtitle?: string;
  message?: string;
  onClose: () => void;
  onReset: () => void;
}

export const CompletionModal: React.FC<CompletionModalProps> = ({
  open,
  won,
  title,
  subtitle,
  message,
  onClose,
  onReset,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="completion-modal-title"
        className="animate-modal relative w-full max-w-[400px] rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 flex flex-col items-center text-center">
          <div
            className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${
              won ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-600'
            }`}
          >
            {won ? <Sparkles className="h-6 w-6" /> : <RotateCcw className="h-6 w-6" />}
          </div>
          <h2
            id="completion-modal-title"
            className="text-xl font-bold tracking-tight text-stone-900"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm font-medium text-stone-500">{subtitle}</p>
          )}
        </div>

        {message && (
          <div className="rounded-xl border border-stone-100 bg-stone-50 p-4 text-center text-[15px] leading-relaxed text-stone-800">
            {message}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          {won ? (
            <>
              <button
                type="button"
                onClick={onReset}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                Nochmal
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
              >
                Schließen
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 active:scale-[0.98]"
              >
                Schließen
              </button>
              <button
                type="button"
                onClick={onReset}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                Neu starten
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
