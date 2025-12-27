import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
}

export function Card({ children, title }: CardProps) {
  return (
    <div className="card bg-base-100 shadow-md w-full">
      {title && (
        <div className="card-title px-4 pt-4 text-base font-bold text-primary-content">
          {title}
        </div>
      )}
      <div className="card-body p-4 pt-2">{children}</div>
    </div>
  );
}
