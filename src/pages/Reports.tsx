import React from 'react';

const Reports: React.FC = () => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs uppercase tracking-wide text-slate-500">Reports</p>
    <h3 className="text-xl font-semibold text-slate-900">Generated reports</h3>
    <p className="mt-2 text-sm text-slate-600">Reports generated from project pages will appear in the Supabase `reports` bucket. Add listing here if needed.</p>
  </div>
);

export default Reports;
