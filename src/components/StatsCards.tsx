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
        <div key={stat.label} className="rounded-xl border border-bpas-grey/20 bg-bpas-light p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-bpas-grey font-syne">{stat.label}</p>
          <p className="mt-2 text-2xl font-syne font-semibold text-bpas-black">{stat.value}</p>
          {stat.accent && <p className="text-xs text-bpas-yellow">{stat.accent}</p>}
        </div>
      ))}
    </div>
  );
};
