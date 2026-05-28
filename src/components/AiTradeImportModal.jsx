import { useState, useRef } from "react";
import { extractTradesFromFiles } from "../api/ai";
import { searchStocks, addTransaction } from "../api/portfolio";
import { useToast } from "../context/ToastContext";

const SOURCE_LABELS = {
    ZERODHA:       "Zerodha",
    GROWW:         "Groww",
    UPSTOX:        "Upstox",
    ANGEL_ONE:     "Angel One",
    DHAN:          "Dhan",
    ICICI:         "ICICI Direct",
    KOTAK:         "Kotak",
    CONTRACT_NOTE: "Contract Note",
    SMS:           "Broker SMS",
    UNKNOWN:       "Screenshot",
};

const CONFIDENCE_STYLE = {
    HIGH:   "bg-green-900/30 text-green-400 border border-green-700/40",
    MEDIUM: "bg-amber-900/30 text-amber-400 border border-amber-700/40",
    LOW:    "bg-red-900/30 text-red-400 border border-red-700/40",
};

const ACCEPTED_TYPES = {
    "image/jpeg": "image", "image/png": "image", "image/webp": "image", "image/gif": "image",
    "application/pdf": "pdf",
    "text/csv": "csv", "text/plain": "txt",
    "application/vnd.ms-excel": "excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "excel",
};

export default function AiTradeImportModal({ onClose, onImported }) {
    const [step,           setStep]           = useState("upload");
    const [dragOver,       setDragOver]       = useState(false);
    const [fileItems,      setFileItems]      = useState([]); // { file, preview, name, ftype, textContent }
    const [extraction,     setExtraction]     = useState(null);
    const [editableTrades, setEditableTrades] = useState([]);
    const [error,          setError]          = useState("");
    const [confirming,     setConfirming]     = useState(false);
    const fileInputRef = useRef(null);
    const toast = useToast();

    // ── File selection ──────────────────────────────────────────────────────

    const handleFiles = async (newFiles) => {
        setError("");
        const arr = Array.from(newFiles).slice(0, 5 - fileItems.length);
        const added = [];

        for (const file of arr) {
            const ftype = ACCEPTED_TYPES[file.type];
            if (!ftype) {
                setError("Unsupported file type. Use images, PDF, Excel, CSV, or TXT.");
                continue;
            }
            if (file.size > 10 * 1024 * 1024) {
                setError(`${file.name} is too large (max 10MB)`);
                continue;
            }

            let preview     = null;
            let textContent = null;

            if (ftype === "image") {
                preview = URL.createObjectURL(file);
            } else if (ftype === "csv" || ftype === "txt") {
                textContent = await file.text();
            } else if (ftype === "excel") {
                try {
                    const { read, utils } = await import("xlsx");
                    const buf = await file.arrayBuffer();
                    const wb  = read(buf);
                    const ws  = wb.Sheets[wb.SheetNames[0]];
                    textContent = utils.sheet_to_csv(ws);
                } catch {
                    setError(`Could not parse ${file.name}. Try saving as CSV.`);
                    continue;
                }
            }

            added.push({ file, preview, name: file.name, ftype, textContent });
        }
        setFileItems(prev => [...prev, ...added].slice(0, 5));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
    };

    // ── AI Analysis ──────────────────────────────────────────────────────────

    const analyzeFiles = async () => {
        if (fileItems.length === 0) return;
        setStep("analyzing");
        setError("");

        try {
            const result = await extractTradesFromFiles(
                fileItems.map(item => ({
                    file: (item.ftype === "csv" || item.ftype === "txt" || item.ftype === "excel")
                        ? null : item.file,
                    textContent: item.textContent || null,
                })).filter(x => x.file || x.textContent)
            );

            setExtraction(result);

            if (result.noTradesFound) {
                setStep("notfound");
                return;
            }

            // Enrich trades — look up missing symbols from our stock DB
            const enriched = await Promise.all(
                result.trades.map(async (t, i) => {
                    let symbol = t.stockSymbol || "";

                    if (!symbol && t.stockName) {
                        try {
                            const res    = await searchStocks(t.stockName);
                            const stocks = res.data?.content || [];
                            if (stocks.length > 0) symbol = stocks[0].symbol;
                        } catch {
                            // silently ignore — user can fill manually
                        }
                    }

                    return {
                        ...t,
                        stockSymbol: symbol,
                        _id:         i,
                        _include:    true,
                        _date:       t.date || "",
                    };
                })
            );

            setEditableTrades(enriched);
            setStep("review");

        } catch (err) {
            const msg = err.response?.data?.message
                || err.response?.data?.error
                || err.message
                || "AI analysis failed. Please try again.";
            setError(msg);
            setStep("upload");
        }
    };

    // ── Trade editing ────────────────────────────────────────────────────────

    const updateTrade = (id, field, value) => {
        setEditableTrades(prev =>
            prev.map(t => t._id === id ? { ...t, [field]: value } : t)
        );
    };

    const toggleInclude = (id) => {
        setEditableTrades(prev =>
            prev.map(t => t._id === id ? { ...t, _include: !t._include } : t)
        );
    };

    // ── Confirm and create transactions ──────────────────────────────────────

    const confirmImport = async () => {
        const selected = editableTrades.filter(t => t._include);
        if (selected.length === 0) {
            setError("Select at least one trade to import");
            return;
        }

        for (const t of selected) {
            if (!t.stockSymbol) {
                setError(`Please enter a stock symbol for "${t.stockName}"`);
                return;
            }
            if (!t._date) {
                setError(`Please select a date for ${t.stockSymbol}`);
                return;
            }
            if (!t.quantity || parseFloat(t.quantity) <= 0) {
                setError(`Invalid quantity for ${t.stockSymbol}`);
                return;
            }
            if (!t.price || parseFloat(t.price) <= 0) {
                setError(`Invalid price for ${t.stockSymbol}`);
                return;
            }
        }

        setConfirming(true);
        setError("");

        let successCount = 0;
        let failCount    = 0;

        for (const trade of selected) {
            try {
                const searchRes = await searchStocks(trade.stockSymbol);
                const stocks    = searchRes.data?.content || [];

                const match = stocks.find(s =>
                    s.symbol === trade.stockSymbol &&
                    s.exchange === (trade.exchange || "NSE")
                ) || stocks.find(s =>
                    s.symbol === trade.stockSymbol
                ) || stocks[0];

                if (!match) {
                    failCount++;
                    continue;
                }

                await addTransaction({
                    stockId:         match.id,
                    type:            trade.transactionType,
                    quantity:        parseFloat(trade.quantity),
                    pricePerShare:   parseFloat(trade.price),
                    transactionDate: trade._date,
                    notes:           `AI import · ${SOURCE_LABELS[extraction?.detectedSource] || "screenshot"}`,
                });
                successCount++;
            } catch {
                failCount++;
            }
        }

        setConfirming(false);

        if (successCount > 0) {
            toast.success(`${successCount} transaction${successCount > 1 ? "s" : ""} imported successfully`);
            onImported?.();
        }
        if (failCount > 0) {
            toast.error(`${failCount} transaction${failCount > 1 ? "s" : ""} failed to import`);
        }

        setStep("done");
    };

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
            <div className={
                "w-full bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl " +
                "flex flex-col overflow-hidden " +
                (step === "review" ? "max-w-3xl max-h-[90vh]" : "max-w-lg")
            }>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                                border-b border-slate-700 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-600/20 border border-purple-500/30
                                        rounded-lg flex items-center justify-center text-lg">
                            ✨
                        </div>
                        <div>
                            <h2 className="text-white font-bold">AI Trade Import</h2>
                            <p className="text-slate-500 text-xs">
                                Upload broker files — AI extracts the trades
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="text-slate-500 hover:text-white text-xl transition-colors">
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto flex-1">

                    {/* ── Upload step ── */}
                    {step === "upload" && (
                        <div className="p-6">

                            {/* Drop zone */}
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={
                                    "border-2 border-dashed rounded-2xl p-6 text-center " +
                                    "cursor-pointer transition-all " +
                                    (dragOver
                                        ? "border-purple-500 bg-purple-900/20"
                                        : fileItems.length > 0
                                            ? "border-blue-500/40 bg-blue-900/5"
                                            : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50")
                                }>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*,.pdf,.xlsx,.xls,.csv,.txt"
                                    multiple
                                    className="hidden"
                                    onChange={e => handleFiles(e.target.files)}
                                />

                                {fileItems.length > 0 ? (
                                    <div>
                                        {/* File preview grid */}
                                        <div className="flex flex-wrap gap-3 justify-center mb-3"
                                             onClick={e => e.stopPropagation()}>
                                            {fileItems.map((item, i) => (
                                                <div key={i} className="relative group">
                                                    {item.ftype === "image" && item.preview ? (
                                                        <img src={item.preview} alt={item.name}
                                                             className="w-20 h-20 object-cover
                                                                        rounded-xl border border-slate-700" />
                                                    ) : (
                                                        <div className="w-20 h-20 rounded-xl
                                                                        border border-slate-700
                                                                        bg-slate-800 flex flex-col
                                                                        items-center justify-center gap-1">
                                                            <span className="text-2xl">
                                                                {item.ftype === "pdf"   ? "📄"
                                                                    : item.ftype === "excel" ? "📊"
                                                                        : item.ftype === "csv"   ? "📋"
                                                                            : "📝"}
                                                            </span>
                                                            <p className="text-slate-400 text-[9px]
                                                                          uppercase font-bold">
                                                                {item.ftype}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <p className="text-[9px] text-slate-500 mt-1
                                                                  truncate text-center w-20">
                                                        {item.name}
                                                    </p>
                                                    {/* Remove */}
                                                    <button
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            setFileItems(prev =>
                                                                prev.filter((_, idx) => idx !== i));
                                                        }}
                                                        className="absolute -top-1.5 -right-1.5
                                                                   w-5 h-5 bg-red-500 hover:bg-red-600
                                                                   text-white rounded-full text-[10px]
                                                                   flex items-center justify-center
                                                                   opacity-0 group-hover:opacity-100
                                                                   transition-opacity z-10">
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                            {/* Add more slot */}
                                            {fileItems.length < 5 && (
                                                <div
                                                    className="w-20 h-20 rounded-xl border-2
                                                               border-dashed border-slate-700
                                                               flex flex-col items-center
                                                               justify-center text-slate-500
                                                               hover:border-slate-500
                                                               cursor-pointer transition-colors gap-1"
                                                    onClick={() => fileInputRef.current?.click()}>
                                                    <span className="text-xl">+</span>
                                                    <span className="text-[9px]">add more</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-slate-400 text-xs">
                                            {fileItems.length}/5 files selected
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl mb-3">📁</div>
                                        <p className="text-white font-semibold mb-1">
                                            Drop your broker files here
                                        </p>
                                        <p className="text-slate-400 text-sm mb-3">
                                            or click to select — up to 5 files at once
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 justify-center">
                                            {["📸 Image", "📄 PDF", "📊 Excel", "📋 CSV", "📝 TXT"].map(t => (
                                                <span key={t}
                                                      className="text-xs bg-slate-800 border
                                                                 border-slate-700 text-slate-400
                                                                 px-2 py-0.5 rounded-full">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tips */}
                            <div className="mt-4 bg-slate-800/60 rounded-xl p-3 space-y-1.5">
                                <p className="text-slate-400 text-xs font-semibold mb-2">
                                    📋 Works best with:
                                </p>
                                {[
                                    "Trade confirmation screens from any broker app",
                                    "Contract notes (PDF or screenshot)",
                                    "Portfolio CSV exports from Zerodha / Groww etc.",
                                    "Broker SMS messages or text records",
                                    "Handwritten trade records (photo)",
                                ].map((tip, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <span className="text-purple-400 mt-0.5">✓</span>
                                        <p className="text-slate-500 text-xs">{tip}</p>
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="mt-4 bg-red-900/30 border border-red-700/50
                                                rounded-xl px-4 py-3 text-red-300 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={analyzeFiles}
                                disabled={fileItems.length === 0}
                                className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-700
                                           disabled:opacity-40 disabled:cursor-not-allowed
                                           text-white font-bold rounded-xl transition-colors">
                                ✨ Analyze with AI
                            </button>

                            <p className="text-center text-slate-600 text-xs mt-2">
                                First 10 analyses per month are complimentary.
                                Fair usage charges apply thereafter.
                            </p>
                        </div>
                    )}

                    {/* ── Analyzing step ── */}
                    {step === "analyzing" && (
                        <div className="p-8 text-center">
                            <div className="relative mx-auto w-20 h-20 mb-6">
                                <div className="w-20 h-20 border-4 border-purple-600/30 rounded-full" />
                                <div className="absolute inset-0 w-20 h-20 border-4
                                                border-purple-600 border-t-transparent
                                                rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center
                                                justify-center text-2xl">✨</div>
                            </div>
                            <h3 className="text-white font-bold text-lg mb-2">
                                Analyzing {fileItems.length} file{fileItems.length !== 1 ? "s" : ""}
                            </h3>
                            <p className="text-slate-400 text-sm mb-1">
                                AI is reading your trade details...
                            </p>
                            <p className="text-slate-600 text-xs">
                                Usually takes 3-10 seconds
                            </p>
                            {/* Show image thumbnails */}
                            <div className="flex gap-2 justify-center mt-6">
                                {fileItems.filter(f => f.ftype === "image").map((f, i) => (
                                    <img key={i} src={f.preview} alt=""
                                         className="h-20 rounded-xl opacity-40 object-contain" />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Not found step ── */}
                    {step === "notfound" && (
                        <div className="p-8 text-center">
                            <div className="text-5xl mb-4">🔍</div>
                            <h3 className="text-white font-bold mb-2">No trades found</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                The AI couldn't extract trade information from these files.
                                Try a clearer screenshot or a different file.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => { setStep("upload"); setFileItems([]); }}
                                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700
                                               text-white font-medium rounded-xl text-sm transition-colors">
                                    Try different files
                                </button>
                                <button onClick={onClose}
                                        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600
                                                   text-slate-300 font-medium rounded-xl text-sm transition-colors">
                                    Enter manually
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Review step ── */}
                    {step === "review" && extraction && (
                        <div className="p-6">

                            <div className="flex items-center gap-3 mb-5">
                                <span className="text-xs px-2.5 py-1 bg-purple-900/40
                                                 text-purple-300 border border-purple-700/40
                                                 rounded-full font-semibold">
                                    {SOURCE_LABELS[extraction.detectedSource] || "Screenshot"}
                                </span>
                                <p className="text-slate-300 text-sm">{extraction.message}</p>
                            </div>

                            <div className="space-y-4">
                                {editableTrades.map(trade => (
                                    <div key={trade._id}
                                         className={
                                             "bg-slate-800 border rounded-xl p-4 transition-all " +
                                             (trade._include
                                                 ? "border-slate-600"
                                                 : "border-slate-700/40 opacity-50")
                                         }>

                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={trade._include}
                                                    onChange={() => toggleInclude(trade._id)}
                                                    className="w-4 h-4 rounded accent-purple-500"
                                                />
                                                <div>
                                                    <p className="text-white font-semibold text-sm">
                                                        {trade.stockName || trade.stockSymbol}
                                                    </p>
                                                    {trade.stockName && trade.stockSymbol && (
                                                        <p className="text-slate-500 text-xs">
                                                            {trade.stockSymbol} · {trade.exchange}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={
                                                    "text-xs px-2 py-0.5 rounded-full font-bold " +
                                                    (trade.transactionType === "BUY"
                                                        ? "bg-green-900/30 text-green-400"
                                                        : "bg-red-900/30 text-red-400")
                                                }>
                                                    {trade.transactionType}
                                                </span>
                                                <span className={
                                                    "text-xs px-2 py-0.5 rounded-full " +
                                                    (CONFIDENCE_STYLE[trade.confidence] || CONFIDENCE_STYLE.MEDIUM)
                                                }>
                                                    {trade.confidence} confidence
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Symbol *</label>
                                                <input
                                                    type="text"
                                                    value={trade.stockSymbol || ""}
                                                    onChange={e => updateTrade(trade._id, "stockSymbol", e.target.value.toUpperCase())}
                                                    placeholder="e.g. RELIANCE"
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Type</label>
                                                <select
                                                    value={trade.transactionType}
                                                    onChange={e => updateTrade(trade._id, "transactionType", e.target.value)}
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500">
                                                    <option value="BUY">BUY</option>
                                                    <option value="SELL">SELL</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Quantity *</label>
                                                <input
                                                    type="number"
                                                    value={trade.quantity || ""}
                                                    onChange={e => updateTrade(trade._id, "quantity", e.target.value)}
                                                    placeholder="0" min="1"
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Price (₹) *</label>
                                                <input
                                                    type="number"
                                                    value={trade.price || ""}
                                                    onChange={e => updateTrade(trade._id, "price", e.target.value)}
                                                    placeholder="0.00" step="0.01"
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs text-slate-500 block mb-1">
                                                    Date *
                                                    {!trade.date && (
                                                        <span className="text-amber-400 ml-1">
                                                            (not found — select manually)
                                                        </span>
                                                    )}
                                                </label>
                                                <input
                                                    type="date"
                                                    value={trade._date || ""}
                                                    onChange={e => updateTrade(trade._id, "_date", e.target.value)}
                                                    max={new Date().toISOString().split("T")[0]}
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-xs text-slate-500 block mb-1">Exchange</label>
                                                <select
                                                    value={trade.exchange || "NSE"}
                                                    onChange={e => updateTrade(trade._id, "exchange", e.target.value)}
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500">
                                                    <option value="NSE">NSE</option>
                                                    <option value="BSE">BSE</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="mt-4 bg-red-900/30 border border-red-700/50
                                                rounded-xl px-4 py-3 text-red-300 text-sm">
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Done step ── */}
                    {step === "done" && (
                        <div className="p-8 text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <h3 className="text-white font-bold text-lg mb-2">Import complete</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Your transactions have been added to your portfolio.
                            </p>
                            <button onClick={onClose}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700
                                               text-white font-semibold rounded-xl text-sm transition-colors">
                                Done
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer — review step only */}
                {step === "review" && (
                    <div className="flex items-center justify-between px-6 py-4
                                    border-t border-slate-700 flex-shrink-0">
                        <button
                            onClick={() => { setStep("upload"); setFileItems([]); }}
                            className="text-sm text-slate-400 hover:text-white transition-colors">
                            ← Try different files
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs">
                                {editableTrades.filter(t => t._include).length} of{" "}
                                {editableTrades.length} selected
                            </span>
                            <button
                                onClick={confirmImport}
                                disabled={confirming ||
                                editableTrades.filter(t => t._include).length === 0}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700
                                           disabled:opacity-40 disabled:cursor-not-allowed
                                           text-white font-bold rounded-xl text-sm transition-colors">
                                {confirming
                                    ? "Importing..."
                                    : `Import ${editableTrades.filter(t => t._include).length} Trade${editableTrades.filter(t => t._include).length !== 1 ? "s" : ""}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}