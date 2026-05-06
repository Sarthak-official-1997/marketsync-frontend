export default function EmptyState({ icon, title, message, action, onAction }) {
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700
                        flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="text-5xl mb-4">{icon}</div>
            <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
            <p className="text-slate-400 text-sm mb-6 max-w-xs">{message}</p>
            {action && (
                <button onClick={onAction}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm
                                   font-medium px-5 py-2.5 rounded-lg transition-colors">
                    {action}
                </button>
            )}
        </div>
    );
}