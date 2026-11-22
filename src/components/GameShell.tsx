import React, { useState, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface GameShellProps {
  title: string;
  onReset: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

export const GameShell: React.FC<GameShellProps> = ({
  title,
  onReset,
  headerRight,
  children,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), 3000);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    onReset();
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-stone-50">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-stone-50/90 px-4 py-3 backdrop-blur-md">
        <span className="w-9" aria-hidden="true" />

        <h1 className="text-base font-bold tracking-tight text-stone-900">
          {title}
        </h1>

        <div className="flex min-w-9 items-center justify-end">
          {headerRight ?? <span className="w-9" />}
        </div>
      </header>

      <main className="flex flex-1 flex-col px-3.5 py-4">{children}</main>

      <footer className="mt-auto border-t border-stone-200/60 px-4 py-3 text-center">
        <button
          type="button"
          onClick={handleResetClick}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            confirmReset
              ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
              : 'text-stone-400 hover:bg-stone-200/60 hover:text-stone-600'
          }`}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {confirmReset ? 'Wirklich neu starten?' : 'Spiel zurücksetzen'}
        </button>
      </footer>
    </div>
  );
};
