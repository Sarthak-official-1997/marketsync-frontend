export function Skeleton({ className = "" }) {
    return <div className={`bg-slate-700/60 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard() {
    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-8 w-36 mb-2" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

export function SkeletonTable({ rows = 5, cols = 5 }) {
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex gap-4 px-4 py-3 border-b border-slate-700">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-3 flex-1" />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 px-4 py-4 border-b border-slate-700/50">
                    {Array.from({ length: cols }).map((_, j) => (
                        <Skeleton key={j} className="h-3 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function SkeletonDashboard() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-32" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                        <Skeleton className="h-5 w-40 mb-4" />
                        <Skeleton className="h-52 w-full rounded-lg" />
                    </div>
                ))}
            </div>
        </div>
    );
}