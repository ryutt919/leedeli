import React, { CSSProperties, forwardRef } from 'react';

interface InputProps {
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  min?: number | string;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  style?: CSSProperties;
  autoFocus?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { type = 'text', value, onChange, placeholder, label, min, max, step, disabled, style, autoFocus },
  ref
) {
  void style;

  return (
    <div className="flex w-full flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input
        ref={ref}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200 disabled:bg-slate-50 disabled:text-slate-500"
        autoFocus={autoFocus}
      />
    </div>
  );
});

export default Input;
