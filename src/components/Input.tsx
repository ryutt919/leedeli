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
    <div className="form-control w-full">
      {label && <label className="label py-1"><span className="label-text text-xs font-semibold">{label}</span></label>}
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
        className="input input-bordered input-sm rounded-lg"
        autoFocus={autoFocus}
      />
    </div>
  );
});

export default Input;
