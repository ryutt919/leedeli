import React, { forwardRef } from 'react';
import type { CSSProperties } from 'react';

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
  return (
    <div className="input-group">
      {label && <label>{label}</label>}
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
        style={style}
        className="input"
        autoFocus={autoFocus}
      />
    </div>
  );
});

export default Input;
