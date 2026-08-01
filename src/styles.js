// Reusable Tailwind class-builder helpers for the site's "3D" card/button
// look, shared by nearly every component in the app.

export const inputCls = (dark) => `w-full h-10 px-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-50 placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'}`;
export const selectCls = (dark) => `h-11 px-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${dark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-white border-slate-300 text-slate-700'}`;
export const pillCls = (dark, active) => `shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${active ? 'bg-emerald-600 text-white border-emerald-600 shadow-[0_3px_0_0_rgba(4,120,87,1)]' : (dark ? 'border-slate-700 text-slate-300 hover:border-slate-600' : 'border-slate-200 text-slate-600 hover:border-slate-300')}`;

export const card3D = (dark, extra = '') =>
  `${extra} border transition-all duration-300 ease-out will-change-transform ` +
  (dark
    ? 'border-slate-800 bg-slate-900 shadow-[0_1px_1px_rgba(0,0,0,0.4),0_10px_20px_-8px_rgba(0,0,0,0.55),0_28px_44px_-18px_rgba(0,0,0,0.65)] hover:shadow-[0_2px_2px_rgba(0,0,0,0.5),0_18px_30px_-8px_rgba(0,0,0,0.6),0_40px_64px_-18px_rgba(0,0,0,0.7)]'
    : 'border-slate-200 bg-white shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_20px_-8px_rgba(15,23,42,0.12),0_28px_44px_-18px_rgba(15,23,42,0.16)] hover:shadow-[0_2px_2px_rgba(15,23,42,0.05),0_18px_30px_-8px_rgba(15,23,42,0.16),0_40px_64px_-18px_rgba(15,23,42,0.2)]') +
  ' hover:-translate-y-1';

export const btn3D = (dark, tone = 'emerald') => {
  const edge = {
    emerald: 'shadow-[0_4px_0_0_rgba(4,120,87,1),0_8px_14px_-4px_rgba(4,120,87,0.45)] active:shadow-[0_1px_0_0_rgba(4,120,87,1),0_2px_4px_-1px_rgba(4,120,87,0.4)]',
    indigo: 'shadow-[0_4px_0_0_rgba(67,56,202,1),0_8px_14px_-4px_rgba(67,56,202,0.45)] active:shadow-[0_1px_0_0_rgba(67,56,202,1),0_2px_4px_-1px_rgba(67,56,202,0.4)]',
    red: 'shadow-[0_4px_0_0_rgba(153,27,27,1),0_8px_14px_-4px_rgba(153,27,27,0.4)] active:shadow-[0_1px_0_0_rgba(153,27,27,1),0_2px_4px_-1px_rgba(153,27,27,0.35)]',
    slate: dark
      ? 'shadow-[0_4px_0_0_rgba(30,41,59,1),0_8px_14px_-4px_rgba(0,0,0,0.5)] active:shadow-[0_1px_0_0_rgba(30,41,59,1),0_2px_4px_-1px_rgba(0,0,0,0.4)]'
      : 'shadow-[0_4px_0_0_rgba(203,213,225,1),0_8px_14px_-4px_rgba(15,23,42,0.15)] active:shadow-[0_1px_0_0_rgba(203,213,225,1),0_2px_4px_-1px_rgba(15,23,42,0.1)]',
  }[tone];
  return `transition-all duration-150 ${edge} hover:-translate-y-0.5 active:translate-y-0.5`;
};
