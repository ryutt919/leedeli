import type { CSSProperties, ReactNode } from 'react';

interface ButtonProps {
    children: ReactNode;
    onClick?: (e: any) => void;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    style?: CSSProperties;
}

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled = false, style }: ButtonProps) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={style}
            className={`btn btn-${variant}`}
        >
            {children}
        </button>
    );
}
