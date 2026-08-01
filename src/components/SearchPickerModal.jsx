// src/components/SearchPickerModal.jsx
// Reusable "type to search, pick a result" modal — for ANY spot in the app
// that needs this pattern (watchlist add-stock, alert stock search, note
// stock-linking, transaction stock lookup, etc.), instead of each screen
// building its own ad-hoc version.
//
// Mobile-first: sits low on screen (thumb reach), with real breathing room
// from the edges (not glued flush). Tracks window.visualViewport so its
// max-height shrinks the moment the on-screen keyboard opens — the box
// naturally stays fully above the keyboard instead of getting hidden
// behind it, with no manual position-shifting math needed.
//
// Usage:
//   <SearchPickerModal
//     title="Add to Watchlist"
//     placeholder="Search symbol or company…"
//     searchFn={(q) => searchStocks(q).then(r => r.data?.content || r.data || [])}
//     renderResult={(s) => (<>{s.symbol} — {s.name}</>)}
//     onPick={(s) => { ...; onClose(); }}
//     onClose={onClose}
//   />

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMobile } from "../hooks/useMobile";

export default function SearchPickerModal({
                                              title, placeholder, searchFn, renderResult, onPick, onClose,
                                              minChars = 2, debounceMs = 300,
                                          }) {
    const isMobile = useMobile();
    const [query, setQuery]     = useState("");
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const debRef   = useRef(null);
    const inputRef = useRef(null);

    // Tracks the visual viewport height (shrinks when the on-screen keyboard
    // opens) so the modal's max-height follows it — the box stays fully
    // visible above the keyboard instead of being covered by it.
    const [viewportH, setViewportH] = useState(
        typeof window !== "undefined" ? window.visualViewport?.height || window.innerHeight : 800
    );

    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const onResize = () => setViewportH(vv.height);
        vv.addEventListener("resize", onResize);
        return () => vv.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        // Autofocus so typing can start immediately — the whole point of a
        // dedicated search modal is skipping an extra tap into the input.
        const t = setTimeout(() => inputRef.current?.focus(), 50);
        return () => clearTimeout(t);
    }, []);

    const onQueryChange = (val) => {
        setQuery(val);
        clearTimeout(debRef.current);
        if (val.trim().length < minChars) { setResults([]); return; }
        setSearching(true);
        debRef.current = setTimeout(() => {
            Promise.resolve(searchFn(val))
                .then(r => setResults((r || []).slice(0, 10)))
                .catch(() => setResults([]))
                .finally(() => setSearching(false));
        }, debounceMs);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9700] flex items-end justify-center"
             onClick={onClose}>
            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

            <div className="relative z-[9701] bg-slate-900 border border-slate-700/60 flex flex-col w-full"
                 style={{
                     maxWidth: isMobile ? "100%" : "480px",
                     // A little breathing room from the bottom edge — not
                     // flush, matching a modern sheet rather than a strip.
                     marginBottom: isMobile ? "calc(18px + env(safe-area-inset-bottom, 0px))" : "40px",
                     marginLeft: isMobile ? "12px" : 0,
                     marginRight: isMobile ? "12px" : 0,
                     borderRadius: "20px",
                     maxHeight: Math.max(260, viewportH - (isMobile ? 90 : 120)),
                     boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
                     overflow: "hidden",
                 }}
                 onClick={e => e.stopPropagation()}>

                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
                    <p className="text-white font-bold text-base">{title}</p>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center
                                       text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">✕</button>
                </div>

                <div className="flex-shrink-0 px-4 pt-3 pb-2">
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={e => onQueryChange(e.target.value)}
                        placeholder={placeholder || "Search…"}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                                   text-white text-base placeholder-slate-500
                                   focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div style={{ flex: "1 1 0", overflowY: "auto", minHeight: 0 }} className="px-3 pb-3">
                    {searching && (
                        <p className="text-slate-500 text-xs px-1 py-2">Searching…</p>
                    )}
                    {!searching && query.trim().length >= minChars && results.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-6">No results for "{query}"</p>
                    )}
                    {results.map((item, i) => (
                        <button key={item.id ?? item.symbol ?? i}
                                onClick={() => onPick(item)}
                                className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-800
                                           active:bg-slate-800 transition-colors border-b border-slate-800 last:border-0">
                            {renderResult ? renderResult(item) : JSON.stringify(item)}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}