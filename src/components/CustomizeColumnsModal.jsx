// src/components/CustomizeColumnsModal.jsx
// Shared by every table that supports customizable columns (Performance,
// MF Holdings, Stocks Holdings, Watchlist, Transactions). Checkbox per
// column + up/down reorder — arrows, not drag-and-drop, deliberately:
// HTML5 drag never fires on touch devices (same reason the board-layout
// reorder feature uses mobile-only ▲▼ buttons instead of drag), so this
// needed to work on mobile from the start rather than needing a second
// touch-specific path bolted on later.

import { useState } from "react";

export default function CustomizeColumnsModal({ columns, onClose, onSave, fixedLabel }) {
    const [localOrder, setLocalOrder] = useState(columns.map(c => c.id));
    const [localVisible, setLocalVisible] = useState(new Set(columns.filter(c => c.visible).map(c => c.id)));

    const byId = Object.fromEntries(columns.map(c => [c.id, c]));
    const orderedItems = localOrder.map(id => byId[id]).filter(Boolean);

    const toggle = (id) => {
        setLocalVisible(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const move = (index, direction) => {
        const target = index + direction;
        if (target < 0 || target >= localOrder.length) return;
        setLocalOrder(prev => {
            const next = [...prev];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    return (
        <div className="fixed inset-0 z-[9700] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
             onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                 className="bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5">
                <p className="text-white font-bold text-base mb-1">Customize columns</p>
                <p className="text-slate-500 text-xs mb-4">
                    {fixedLabel ? `${fixedLabel} is always shown. ` : ""}Reorder or hide the rest.
                </p>

                <div className="space-y-1.5 mb-5 max-h-[60vh] overflow-y-auto">
                    {orderedItems.map((col, i) => (
                        <div key={col.id}
                             className="flex items-center gap-2.5 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5">
                            <input
                                type="checkbox"
                                checked={localVisible.has(col.id)}
                                onChange={() => toggle(col.id)}
                                className="w-4 h-4 rounded accent-blue-600 flex-shrink-0"
                            />
                            <span className={"flex-1 text-sm " + (localVisible.has(col.id) ? "text-white" : "text-slate-500")}>
                                {col.label}
                            </span>
                            <div className="flex flex-col gap-0.5 flex-shrink-0">
                                <button onClick={() => move(i, -1)} disabled={i === 0}
                                        className="w-6 h-5 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-25 disabled:hover:text-slate-400 text-[10px] leading-none">
                                    ▲
                                </button>
                                <button onClick={() => move(i, 1)} disabled={i === orderedItems.length - 1}
                                        className="w-6 h-5 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-25 disabled:hover:text-slate-400 text-[10px] leading-none">
                                    ▼
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose}
                            className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-xl transition-colors">
                        Cancel
                    </button>
                    <button onClick={() => onSave(localOrder, [...localVisible])}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}