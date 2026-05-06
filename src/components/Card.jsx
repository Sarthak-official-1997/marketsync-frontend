export default function Card({ title, value, subtitle, color = "text-white" }) {
    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <p className="text-sm text-slate-400 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
    );
}