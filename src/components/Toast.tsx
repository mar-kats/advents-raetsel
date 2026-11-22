import React from 'react';

interface ToastProps {
  message: string | null;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2 px-4"
    >
      <div className="rounded-xl bg-stone-900 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg">
        {message}
      </div>
    </div>
  );
};
