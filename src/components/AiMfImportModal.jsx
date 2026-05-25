import { useState, useRef } from "react";
import { extractMfTradesFromImage } from "../api/ai";
import { searchMfSchemes, addMfTransaction } from "../api/portfolio";
import { useToast } from "../context/ToastContext";

const SOURCE_LABELS = {
    COIN:       "Zerodha COIN",
    GROWW:      "Groww",
    KUVERA:     "Kuvera",
    MF_CENTRAL: "MF Central",
    CAMS:       "CAMS",
    KFINTECH:   "KFintech",
    AMC_PORTAL: "AMC Portal",
    STATEMENT:  "Account Statement",
    UNKNOWN:    "Screenshot",
};

const TX_TYPE_LABELS = {
    PURCHASE:              "Purchase",
    SIP:                   "SIP",
    REDEMPTION:            "Redemption",
    SWITCH_IN:             "Switch In",
    SWITCH_OUT:            "Switch Out",
    DIVIDEND_REINVESTMENT: "Dividend Reinvest",
};

const TX_TYPES = Object.entries(TX_TYPE_LABELS);

const CONFIDENCE_STYLE = {
    HIGH:   "bg-green-900/30 text-green-400 border border-green-700/40",
    MEDIUM: "bg-amber-900/30 text-amber-400 border border-amber-700/40",
    LOW:    "bg-red-900/30 text-red-400 border border-red-700/40",
};

const isBuyType = (t) =>
    ["PURCHASE", "SIP", "SWITCH_IN", "DIVIDEND_REINVESTMENT"].includes(t);

export default function AiMfImportModal({ onClose, onImported }) {
    const [step,           setStep]           = useState("upload");
    const [dragOver,       setDragOver]       = useState(false);
    const [imageFile,      setImageFile]      = useState(null);
    const [imagePreview,   setImagePreview]   = useState(null);
    const [extraction,     setExtraction]     = useState(null);
    const [editableTrades, setEditableTrades] = useState([]);
    const [error,          setError]          = useState("");
    const [confirming,     setConfirming]     = useState(false);
    const fileInputRef = useRef(null);
    const toast = useToast();

    // ── File handling ────────────────────────────────────────────────────────

    const handleFile = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("Please upload an image file (JPEG, PNG, WebP)"); return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError("Image too large — please use an image under 5MB"); return;
        }
        setError("");
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
    };

    // ── AI Analysis ──────────────────────────────────────────────────────────

    const analyzeImage = async () => {
        if (!imageFile) return;
        setStep("analyzing"); setError("");

        try {
            const result = await extractMfTradesFromImage(imageFile);
            setExtraction(result);

            if (result.noTradesFound) { setStep("notfound"); return; }

            // Enrich with scheme search
            const enriched = await Promise.all(
                result.trades.map(async (t, i) => {
                    let schemeCode = null;
                    let resolvedName = t.schemeName || "";

                    if (resolvedName) {
                        try {
                            const res = await searchMfSchemes(resolvedName);
                            const schemes = res.data?.content || [];
                            if (schemes.length > 0) {
                                schemeCode   = schemes[0].schemeCode;
                                resolvedName = schemes[0].schemeName;
                            }
                        } catch {}
                    }

                    return {
                        ...t,
                        _id:          i,
                        _include:     true,
                        _date:        t.date || "",
                        _schemeName:  resolvedName,
                        _schemeCode:  schemeCode,
                        _searchResults: [],
                        _searching:   false,
                    };
                })
            );

            setEditableTrades(enriched);
            setStep("review");

        } catch (err) {
            const msg = err.response?.data?.message || err.message
                || "AI analysis failed. Please try again.";
            setError(msg);
            setStep("upload");
        }
    };

    // ── Trade editing ────────────────────────────────────────────────────────

    const updateTrade = (id, field, value) =>
        setEditableTrades(prev =>
            prev.map(t => t._id === id ? { ...t, [field]: value } : t));

    const toggleInclude = (id) =>
        setEditableTrades(prev =>
            prev.map(t => t._id === id ? { ...t, _include: !t._include } : t));

    const searchScheme = async (id, query) => {
        updateTrade(id, "_schemeName", query);
        updateTrade(id, "_schemeCode", null);
        if (query.length < 3) { updateTrade(id, "_searchResults", []); return; }
        updateTrade(id, "_searching", true);
        try {
            const res = await searchMfSchemes(query);
            updateTrade(id, "_searchResults", res.data?.content || []);
        } catch {} finally { updateTrade(id, "_searching", false); }
    };

    const selectScheme = (id, scheme) => {
        setEditableTrades(prev => prev.map(t => t._id === id ? {
            ...t,
            _schemeName:    scheme.schemeName,
            _schemeCode:    scheme.schemeCode,
            _searchResults: [],
        } : t));
    };

    // ── Confirm ──────────────────────────────────────────────────────────────

    const confirmImport = async () => {
        const selected = editableTrades.filter(t => t._include);
        if (selected.length === 0) { setError("Select at least one transaction"); return; }

        for (const t of selected) {
            if (!t._schemeCode) {
                setError(`Could not find scheme for "${t._schemeName}" — please select from the dropdown`);
                return;
            }
            if (!t._date) {
                setError(`Please select a date for "${t._schemeName}"`); return;
            }
            const units = parseFloat(t.units);
            const nav   = parseFloat(t.nav);
            if (!units || units <= 0) {
                setError(`Invalid units for "${t._schemeName}"`); return;
            }
            if (!nav || nav <= 0) {
                setError(`Invalid NAV for "${t._schemeName}"`); return;
            }
        }

        setConfirming(true); setError("");
        let successCount = 0, failCount = 0;

        for (const trade of selected) {
            try {
                await addMfTransaction({
                    schemeCode:       trade._schemeCode,
                    transactionType:  trade.transactionType,
                    units:            parseFloat(parseFloat(trade.units).toFixed(6)),
                    navAtTransaction: parseFloat(trade.nav),
                    transactionDate:  trade._date,
                    notes: `AI import · ${SOURCE_LABELS[extraction?.detectedSource] || "screenshot"}`,
                });
                successCount++;
            } catch (err) {
                failCount++;
                console.error(`Failed to import ${trade._schemeName}:`, err);
            }
        }

        setConfirming(false);
        if (successCount > 0) {
            toast.success(`${successCount} MF transaction${successCount > 1 ? "s" : ""} imported`);
            onImported?.();
        }
        if (failCount > 0)
            toast.error(`${failCount} transaction${failCount > 1 ? "s" : ""} failed`);
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
                            <h2 className="text-white font-bold">AI MF Import</h2>
                            <p className="text-slate-500 text-xs">
                                Upload any MF statement screenshot — AI extracts transactions
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="text-slate-500 hover:text-white text-xl transition-colors">
                        ✕
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">

                    {/* ── Upload ── */}
                    {step === "upload" && (
                        <div className="p-6">
                            <div
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={
                                    "border-2 border-dashed rounded-2xl p-8 text-center " +
                                    "cursor-pointer transition-all " +
                                    (dragOver
                                        ? "border-purple-500 bg-purple-900/20"
                                        : imageFile
                                            ? "border-green-500/50 bg-green-900/10"
                                            : "border-slate-600 hover:border-slate-500 " +
                                            "hover:bg-slate-800/50")
                                }>
                                <input ref={fileInputRef} type="file" accept="image/*"
                                       className="hidden"
                                       onChange={e => handleFile(e.target.files[0])} />
                                {imagePreview ? (
                                    <div>
                                        <img src={imagePreview} alt="Preview"
                                             className="max-h-48 mx-auto rounded-xl mb-3 object-contain" />
                                        <p className="text-green-400 text-sm font-medium">
                                            ✓ {imageFile?.name}
                                        </p>
                                        <p className="text-slate-500 text-xs mt-1">
                                            Click to change image
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="text-4xl mb-3">📊</div>
                                        <p className="text-white font-semibold mb-1">
                                            Drop your MF statement screenshot here
                                        </p>
                                        <p className="text-slate-400 text-sm mb-4">
                                            or click to select a file
                                        </p>
                                        <p className="text-slate-600 text-xs">
                                            COIN · Groww · Kuvera · MF Central · CAMS
                                            · KFintech · AMC Portals · Account Statements
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 bg-slate-800/60 rounded-xl p-3 space-y-1.5">
                                <p className="text-slate-400 text-xs font-semibold mb-2">
                                    📋 Works best with:
                                </p>
                                {[
                                    "Purchase/SIP confirmation from any MF app",
                                    "CAMS or KFintech account statement",
                                    "Redemption confirmation emails (screenshot)",
                                    "AMC portal transaction history",
                                    "Consolidated account statement (CAS)",
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

                            <button onClick={analyzeImage} disabled={!imageFile}
                                    className="w-full mt-4 py-3 bg-purple-600 hover:bg-purple-700
                                               disabled:opacity-40 disabled:cursor-not-allowed
                                               text-white font-bold rounded-xl transition-colors">
                                ✨ Analyze with AI
                            </button>
                            <p className="text-center text-slate-600 text-xs mt-2">
                                First 10 analyses per month are complimentary.
                            </p>
                            <p className="text-center text-slate-600 text-xs mt-2">
                                Fair usage cost applies thereafter.
                            </p>
                        </div>
                    )}

                    {/* ── Analyzing ── */}
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
                                Analyzing your screenshot
                            </h3>
                            <p className="text-slate-400 text-sm mb-1">
                                AI is reading your MF transaction details...
                            </p>
                            <p className="text-slate-600 text-xs">Usually takes 3-6 seconds</p>
                            {imagePreview && (
                                <img src={imagePreview} alt="Analyzing"
                                     className="max-h-32 mx-auto rounded-xl mt-6 opacity-40 object-contain" />
                            )}
                        </div>
                    )}

                    {/* ── Not found ── */}
                    {step === "notfound" && (
                        <div className="p-8 text-center">
                            <div className="text-5xl mb-4">🔍</div>
                            <h3 className="text-white font-bold mb-2">No transactions found</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                The AI couldn't extract MF transaction info from this image.
                                Try a clearer screenshot.
                            </p>
                            <div className="flex gap-3 justify-center">
                                <button onClick={() => {
                                    setStep("upload");
                                    setImageFile(null); setImagePreview(null);
                                }}
                                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700
                                                   text-white font-medium rounded-xl text-sm">
                                    Try another image
                                </button>
                                <button onClick={onClose}
                                        className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600
                                                   text-slate-300 font-medium rounded-xl text-sm">
                                    Enter manually
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Review ── */}
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
                                        {/* Card header */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <input type="checkbox"
                                                       checked={trade._include}
                                                       onChange={() => toggleInclude(trade._id)}
                                                       className="w-4 h-4 rounded accent-purple-500" />
                                                <div>
                                                    <p className="text-white font-semibold text-sm truncate max-w-xs">
                                                        {trade._schemeName || trade.schemeName || "Unknown Scheme"}
                                                    </p>
                                                    {trade.fundHouse && (
                                                        <p className="text-slate-500 text-xs">
                                                            {trade.fundHouse}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={
                                                    "text-xs px-2 py-0.5 rounded-full font-bold " +
                                                    (isBuyType(trade.transactionType)
                                                        ? "bg-green-900/30 text-green-400"
                                                        : "bg-red-900/30 text-red-400")
                                                }>
                                                    {TX_TYPE_LABELS[trade.transactionType] || trade.transactionType}
                                                </span>
                                                <span className={
                                                    "text-xs px-2 py-0.5 rounded-full " +
                                                    (CONFIDENCE_STYLE[trade.confidence] || CONFIDENCE_STYLE.MEDIUM)
                                                }>
                                                    {trade.confidence}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Scheme search */}
                                        <div className="mb-3 relative">
                                            <label className="text-xs text-slate-500 block mb-1">
                                                Scheme *
                                                {trade._schemeCode
                                                    ? <span className="text-green-400 ml-1">✓ matched</span>
                                                    : <span className="text-amber-400 ml-1">search to confirm</span>}
                                            </label>
                                            <input
                                                type="text"
                                                value={trade._schemeName || ""}
                                                onChange={e => searchScheme(trade._id, e.target.value)}
                                                placeholder="Search scheme name..."
                                                className={`w-full bg-slate-700 border rounded-lg
                                                           px-3 py-2 text-white text-sm
                                                           focus:outline-none ${
                                                    trade._schemeCode
                                                        ? "border-green-600/60 focus:border-green-500"
                                                        : "border-slate-600 focus:border-purple-500"
                                                }`}
                                            />
                                            {trade._searching && (
                                                <div className="absolute right-3 top-8">
                                                    <div className="w-3 h-3 border-2 border-purple-400
                                                                    border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}
                                            {(trade._searchResults || []).length > 0 && (
                                                <div className="absolute z-20 w-full mt-1 bg-slate-700
                                                                border border-slate-600 rounded-xl shadow-xl
                                                                max-h-48 overflow-y-auto">
                                                    {trade._searchResults.map(s => (
                                                        <button key={s.schemeCode}
                                                                type="button"
                                                                onClick={() => selectScheme(trade._id, s)}
                                                                className="w-full text-left px-3 py-2
                                                                           hover:bg-slate-600 border-b
                                                                           border-slate-600/50 last:border-0">
                                                            <p className="text-white text-xs font-medium truncate">
                                                                {s.schemeName}
                                                            </p>
                                                            <p className="text-slate-400 text-[10px]">
                                                                {s.fundHouse}
                                                            </p>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Editable fields */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">
                                                    Type
                                                </label>
                                                <select
                                                    value={trade.transactionType}
                                                    onChange={e => updateTrade(trade._id, "transactionType", e.target.value)}
                                                    className="w-full bg-slate-700 border border-slate-600
                                                               rounded-lg px-3 py-2 text-white text-xs
                                                               focus:outline-none focus:border-purple-500">
                                                    {TX_TYPES.map(([v, l]) => (
                                                        <option key={v} value={v}>{l}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">
                                                    Units *
                                                </label>
                                                <input type="number" step="0.0001" min="0.0001"
                                                       value={trade.units || ""}
                                                       onChange={e => updateTrade(trade._id, "units", e.target.value)}
                                                       placeholder="e.g. 10.5678"
                                                       className="w-full bg-slate-700 border border-slate-600
                                                                  rounded-lg px-3 py-2 text-white text-sm
                                                                  focus:outline-none focus:border-purple-500" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">
                                                    NAV (₹) *
                                                </label>
                                                <input type="number" step="0.01" min="0.01"
                                                       value={trade.nav || ""}
                                                       onChange={e => updateTrade(trade._id, "nav", e.target.value)}
                                                       placeholder="e.g. 123.45"
                                                       className="w-full bg-slate-700 border border-slate-600
                                                                  rounded-lg px-3 py-2 text-white text-sm
                                                                  focus:outline-none focus:border-purple-500" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">
                                                    Date *
                                                    {!trade.date && (
                                                        <span className="text-amber-400 ml-1">select manually</span>
                                                    )}
                                                </label>
                                                <input type="date"
                                                       value={trade._date || ""}
                                                       onChange={e => updateTrade(trade._id, "_date", e.target.value)}
                                                       max={new Date().toISOString().split("T")[0]}
                                                       className="w-full bg-slate-700 border border-slate-600
                                                                  rounded-lg px-3 py-2 text-white text-sm
                                                                  focus:outline-none focus:border-purple-500" />
                                            </div>
                                        </div>

                                        {/* Amount preview */}
                                        {trade.units && trade.nav && (
                                            <div className="mt-3 flex items-center justify-between
                                                            bg-slate-700/40 rounded-lg px-3 py-2">
                                                <span className="text-slate-400 text-xs">Amount</span>
                                                <span className="text-white text-sm font-bold">
                                                    ₹{(parseFloat(trade.units) * parseFloat(trade.nav)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        )}

                                        {trade.extractionNote && (
                                            <p className="mt-2 text-amber-400/70 text-xs italic">
                                                ⚠ {trade.extractionNote}
                                            </p>
                                        )}
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

                    {/* ── Done ── */}
                    {step === "done" && (
                        <div className="p-8 text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <h3 className="text-white font-bold text-lg mb-2">Import complete</h3>
                            <p className="text-slate-400 text-sm mb-6">
                                Your MF transactions have been added to your portfolio.
                            </p>
                            <button onClick={onClose}
                                    className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700
                                               text-white font-semibold rounded-xl text-sm">
                                Done
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer — review only */}
                {step === "review" && (
                    <div className="flex items-center justify-between px-6 py-4
                                    border-t border-slate-700 flex-shrink-0">
                        <button onClick={() => {
                            setStep("upload");
                            setImageFile(null); setImagePreview(null);
                        }}
                                className="text-sm text-slate-400 hover:text-white transition-colors">
                            ← Try different image
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-xs">
                                {editableTrades.filter(t => t._include).length} of{" "}
                                {editableTrades.length} selected
                            </span>
                            <button onClick={confirmImport}
                                    disabled={confirming || editableTrades.filter(t => t._include).length === 0}
                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700
                                               disabled:opacity-40 disabled:cursor-not-allowed
                                               text-white font-bold rounded-xl text-sm transition-colors">
                                {confirming
                                    ? "Importing..."
                                    : `Import ${editableTrades.filter(t => t._include).length} Transaction${editableTrades.filter(t => t._include).length !== 1 ? "s" : ""}`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}