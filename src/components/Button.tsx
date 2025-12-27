import React, { CSSProperties } from 'react';

export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: CSSProperties;
}

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false }: ButtonProps) {
  let color = 'primary';
  if (variant === 'secondary') color = 'secondary';
  if (variant === 'danger') color = 'error';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${color} btn-sm rounded-lg font-semibold`}
    >
      {children}
    </button>
  );
}
