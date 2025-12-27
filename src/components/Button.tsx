import React, { CSSProperties } from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: CSSProperties;
}

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, style }: ButtonProps) {
  void style;

  const baseClassName =
    'inline-flex h-9 w-auto items-center justify-center rounded-lg px-3 text-sm font-medium whitespace-nowrap ' +
    'border focus:outline-none focus:ring-2 focus:ring-offset-1 active:translate-y-px ' +
    'disabled:pointer-events-none disabled:opacity-50';

  const variantClassName =
    variant === 'danger'
      ? 'bg-rose-600 text-white border-rose-600 focus:ring-rose-200'
      : variant === 'secondary'
        ? 'bg-white text-slate-700 border-slate-200 focus:ring-slate-200'
        : 'bg-sky-600 text-white border-sky-600 focus:ring-sky-200';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClassName} ${variantClassName}`}
    >
      {children}
    </button>
  );
}
