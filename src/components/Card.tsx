import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: string;
}

export function Card({ children, title }: CardProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      {title && (
        <div className="border-b border-slate-200 px-3 py-2">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
