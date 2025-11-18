import React from 'react';

interface Stat {
  label: string;
  value: string | number;
  accent?: string;
}

export const StatsCards: React.FC<{ stats: Stat[] }> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
          {stat.accent && <p className="text-xs text-brand">{stat.accent}</p>}
        </div>
      ))}
    </div>
  );
};
