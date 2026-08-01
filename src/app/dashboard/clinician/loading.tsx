import { Bone } from '@/components/dashboard/Bone';

export default function ClinicianLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="space-y-2">
        <Bone className="h-3 w-28" />
        <Bone className="h-7 w-44" />
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <Bone className="h-2.5 w-20" />
            <Bone className="h-8 w-12" />
          </div>
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full animate-pulse bg-slate-800/70 shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-32" />
            <Bone className="h-2.5 w-48" />
          </div>
          <Bone className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
