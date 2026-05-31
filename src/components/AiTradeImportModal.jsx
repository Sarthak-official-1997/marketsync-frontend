import { useState, useRef } from "react";
import { extractTradesFromFiles } from "../api/ai";
import { searchStocks, addTransaction } from "../api/portfolio";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import AiTokenWarningModal from "./AiTokenWarningModal";

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

// -- Token estimation ----------------------------------------------------------
// Rough pre-call estimate. Text: 1 token ≈ 4 chars. Images: min 258 tokens.
// +500 for the system prompt.
function estimatePromptTokens(items) {
    let total = 500;
    for (const item of items) {
        if (item.ftype === "image") {
            total += Math.max(258, Math.round((item.file?.size || 0) / 200));
        } else if (item.ftype === "pdf") {
            total += Math.round((item.file?.size || 0) / 100);
        } else if (item.textContent) {
            total += Math.round(item.textContent.length / 4);
        }
    }
    return total;
}

// Sequential warning thresholds shown to CREATOR before the API call
const WARNING_THRESHOLDS = [12000, 20000, 25000];

export default function AiTradeImportModal({ onClose, onImported }) {
    const { isCreator } = useAuth();

    const [step,           setStep]           = useState("upload");
    const [dragOver,       setDragOver]       = useState(false);
    const [fileItems,      setFileItems]      = useState([]);
    const [extraction,     setExtraction]     = useState(null);
    const [editableTrades, setEditableTrades] = useState([]);
    const [error,          setError]          = useState("");
    const [confirming,     setConfirming]     = useState(false);

    // Token warning — Promise-based so we can await user's decision sequentially
    const [tokenWarning,   setTokenWarning]   = useState(null); // { level, estimated, resolve }

    const fileInputRef = useRef(null);
    const toast = useToast();

    // -- File selection ------------------------------------------------------

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

    // -- Token warning helpers ------------------------------------------------─

    const showWarning = (level, estimated) =>
        new Promise(resolve => setTokenWarning({ level, estimated, resolve }));

    const handleWarningContinue = () => {
        if (!tokenWarning) return;
        tokenWarning.resolve(true);
        setTokenWarning(null);
    };

    const handleWarningStop = () => {
        if (!tokenWarning) return;
        tokenWarning.resolve(false);
        setTokenWarning(null);
    };

    // -- AI Analysis ----------------------------------------------------------

    const analyzeFiles = async () => {
        if (fileItems.length === 0) return;
        setError("");

        // Sequential token warnings for CREATOR only
        if (isCreator) {
            const estimated = estimatePromptTokens(fileItems);
            for (let i = 0; i < WARNING_THRESHOLDS.length; i++) {
                if (estimated >= WARNING_THRESHOLDS[i]) {
                    const confirmed = await showWarning(i + 1, estimated);
                    if (!confirmed) return; // user chose to stop
                }
            }
        }

        setStep("analyzing");

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
                    return { ...t, stockSymbol: symbol, _id: i, _include: true, _date: t.date || "" };
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
                    console.error(`Stock not found in system: ${trade.stockSymbol}`);
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
            } catch (err) {
                failCount++;
                console.error(`Failed to import ${trade.stockSymbol}:`, err);
            }
        }

        setConfirming(false);

        if (successCount > 0) {
            toast.success(
                `${successCount} transaction${successCount > 1 ? "s" : ""} imported successfully`
            );
            onImported?.();
        }
        if (failCount > 0) {
            toast.error(`${failCount} transaction${failCount > 1 ? "s" : ""} failed to import`);
        }

        setStep("done");
    };

    // -- Render --------------------------------------------------------------─

    return (
        <>
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
                                    Upload any broker screenshot — AI extracts the trades
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

                        {/* -- Step: Upload -- */}
                        {step === "upload" && (
                            <div className="p-6">

                                {/* Drop zone */}
                                <div
                                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={
                                        "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer " +
                                        "transition-all " +
                                        (dragOver
                                            ? "border-purple-500 bg-purple-900/20"
                                            : fileItems.length > 0
                                                ? "border-green-500/50 bg-green-900/10"
                                                : "border-slate-600 hover:border-slate-500 hover:bg-slate-800/50")
                                    }>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => handleFiles(e.target.files)}
                                    />

                                    {fileItems[0]?.preview ? (
                                        <div>
                                            <img src={fileItems[0]?.preview} alt="Preview"
                                                 className="max-h-48 mx-auto rounded-xl mb-3 object-contain" />
                                            <p className="text-green-400 text-sm font-medium">
                                                ✓ {fileItems[0]?.file?.name}
                                            </p>
                                            <p className="text-slate-500 text-xs mt-1">
                                                Click to change image
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-4xl mb-3">📸</div>
                                            <p className="text-white font-semibold mb-1">
                                                Drop your broker screenshot here
                                            </p>
                                            <p className="text-slate-400 text-sm mb-4">
                                                or click to select a file
                                            </p>
                                            <p className="text-slate-600 text-xs">
                                                Zerodha · Groww · Upstox · Angel One · Dhan
                                                · ICICI · Kotak · Contract Notes · SMS
                                            </p>
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
                                        "Contract notes (PDF screenshot or photo)",
                                        "Portfolio page showing your holdings",
                                        "Broker SMS messages",
                                        "Handwritten trade records",
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

                                </p>
                                <p className="text-center text-slate-600 text-xs mt-2">

                                    Fair usage charges applies thereafter.
                                </p>
                            </div>
                        )}

                        {/* -- Step: Analyzing -- */}
                        {step === "analyzing" && (
                            <div className="p-8 text-center">
                                <div className="relative mx-auto w-20 h-20 mb-6">
                                    <div className="w-20 h-20 border-4 border-purple-600/30
                                                rounded-full" />
                                    <div className="absolute inset-0 w-20 h-20 border-4
                                                border-purple-600 border-t-transparent
                                                rounded-full animate-spin" />
                                    <div className="absolute inset-0 flex items-center
                                                justify-center text-2xl">✨</div>
                                </div>
                                <h3 className="text-white font-bold text-lg mb-2">
                                    Analyzing your screenshot
                                </h3>
                                <p className="text-slate-400 text-sm mb-1">
                                    AI is reading your trade details...
                                </p>
                                <p className="text-slate-600 text-xs">
                                    Usually takes 3-6 seconds
                                </p>
                                {fileItems[0]?.preview && (
                                    <img src={fileItems[0]?.preview} alt="Analyzing"
                                         className="max-h-32 mx-auto rounded-xl mt-6 opacity-40 object-contain" />
                                )}
                            </div>
                        )}

                        {/* -- Step: Not found -- */}
                        {step === "notfound" && (
                            <div className="p-8 text-center">
                                <div className="text-5xl mb-4">🔍</div>
                                <h3 className="text-white font-bold mb-2">
                                    No trades found
                                </h3>
                                <p className="text-slate-400 text-sm mb-6">
                                    The AI couldn't extract trade information from this image.
                                    Try a clearer screenshot or a different view.
                                </p>
                                <div className="flex gap-3 justify-center">
                                    <button
                                        onClick={() => {
                                            setStep("upload");
                                            setImageFile(null);
                                            setImagePreview(null);
                                        }}
                                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700
                                               text-white font-medium rounded-xl text-sm transition-colors">
                                        Try another image
                                    </button>
                                    <button onClick={onClose}
                                            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600
                                                   text-slate-300 font-medium rounded-xl text-sm transition-colors">
                                        Enter manually
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* -- Step: Review -- */}
                        {step === "review" && extraction && (
                            <div className="p-6">

                                {/* Source badge + message */}
                                <div className="flex items-center gap-3 mb-5">
                                <span className="text-xs px-2.5 py-1 bg-purple-900/40
                                                 text-purple-300 border border-purple-700/40
                                                 rounded-full font-semibold">
                                    {SOURCE_LABELS[extraction.detectedSource] || "Screenshot"}
                                </span>
                                    <p className="text-slate-300 text-sm">{extraction.message}</p>
                                </div>

                                {/* Trade cards */}
                                <div className="space-y-4">
                                    {editableTrades.map(trade => (
                                        <div key={trade._id}
                                             className={
                                                 "bg-slate-800 border rounded-xl p-4 transition-all " +
                                                 (trade._include
                                                     ? "border-slate-600"
                                                     : "border-slate-700/40 opacity-50")
                                             }>

                                            {/* Trade header */}
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

                                            {/* Editable fields */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">
                                                        Symbol *
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={trade.stockSymbol || ""}
                                                        onChange={e => updateTrade(trade._id,
                                                            "stockSymbol",
                                                            e.target.value.toUpperCase())}
                                                        placeholder="e.g. RELIANCE"
                                                        className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">
                                                        Type
                                                    </label>
                                                    <select
                                                        value={trade.transactionType}
                                                        onChange={e => updateTrade(trade._id,
                                                            "transactionType", e.target.value)}
                                                        className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500">
                                                        <option value="BUY">BUY</option>
                                                        <option value="SELL">SELL</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">
                                                        Quantity *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={trade.quantity || ""}
                                                        onChange={e => updateTrade(trade._id,
                                                            "quantity", e.target.value)}
                                                        placeholder="0"
                                                        min="1"
                                                        className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-xs text-slate-500 block mb-1">
                                                        Price (₹) *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={trade.price || ""}
                                                        onChange={e => updateTrade(trade._id,
                                                            "price", e.target.value)}
                                                        placeholder="0.00"
                                                        step="0.01"
                                                        className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>

                                                <div className="col-span-2 md:col-span-2">
                                                    <label className="text-xs text-slate-500 block mb-1">
                                                        Date *
                                                        {!trade.date && (
                                                            <span className="text-amber-400 ml-1">
                                                            (not found in image — select manually)
                                                        </span>
                                                        )}
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={trade._date || ""}
                                                        onChange={e => updateTrade(trade._id,
                                                            "_date", e.target.value)}
                                                        max={new Date().toISOString().split("T")[0]}
                                                        className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-sm
                                                               focus:outline-none focus:border-purple-500"
                                                    />
                                                </div>

                                                <div className="col-span-2">
                                                    <label className="text-xs text-slate-500 block mb-1">
                                                        Exchange
                                                    </label>
                                                    <select
                                                        value={trade.exchange || "NSE"}
                                                        onChange={e => updateTrade(trade._id,
                                                            "exchange", e.target.value)}
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

                        {/* -- Step: Done -- */}
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

                    {/* Footer — only on review step */}
                    {step === "review" && (
                        <div className="flex items-center justify-between px-6 py-4
                                    border-t border-slate-700 flex-shrink-0">
                            <button
                                onClick={() => {
                                    setStep("upload");
                                    setImageFile(null);
                                    setImagePreview(null);
                                }}
                                className="text-sm text-slate-400 hover:text-white transition-colors">
                                ← Try different image
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

            {/* Token warning modal — shown before API call, CREATOR only */}
            {tokenWarning && (
                <AiTokenWarningModal
                    level={tokenWarning.level}
                    estimatedTokens={tokenWarning.estimated}
                    onContinue={handleWarningContinue}
                    onStop={handleWarningStop}
                />
            )}
        </>
    );
}