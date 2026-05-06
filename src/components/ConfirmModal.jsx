export default function ConfirmModal({
                                         isOpen, title, message,
                                         confirmLabel = "Confirm",
                                         confirmClass  = "bg-red-600 hover:bg-red-700",
                                         onConfirm, onCancel,
                                     }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                 onClick={onCancel} />
            <div className="relative bg-slate-800 rounded-2xl border border-slate-600
                            shadow-2xl w-full max-w-sm p-6">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel}
                            className="px-4 py-2 text-sm text-slate-300 bg-slate-700
                                       hover:bg-slate-600 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={onConfirm}
                            className={`px-4 py-2 text-sm text-white font-medium
                                        rounded-lg transition-colors ${confirmClass}`}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}