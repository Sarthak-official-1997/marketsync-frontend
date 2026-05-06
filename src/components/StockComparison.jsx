import { useState } from "react";
import { searchStocks, getStockPrice } from "../api/portfolio";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

const fmt = (val) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency", currency: "INR", maximumFractionDigits: 2
    }).format(val);

const COLORS = ["#3b82f6", "#10b981"];

export default function StockComparison() {
    const [stocks, setStocks]     = useState([]);
    const [query, setQuery]       = useState("");
    const [results, setResults]   = useState([]);

    const handleSearch = async (q) => {
        setQuery(q);
        if (q.length < 2) { setResults([]); return; }
        try {
            const res = await searchStocks(q);
            setResults(res.data.content || []);
        } catch { setResults([]); }
    };

    const addStock = async (stock) => {
        if (stocks.find(s => s.id === stock.id) || stocks.length >= 2) return;
        setQuery(""); setResults([]);
        try {
            const priceRes = await getStockPrice(stock.symbol);
            setStocks(prev => [...prev, { ...stock, price: priceRes.data }]);
        } catch {
            setStocks(prev => [...prev, { ...stock, price: null }]);
        }
    };

    const removeStock = (id) => setStocks(prev => prev.filter(s => s.id !== id));

    const chartData = stocks.length > 0 ? [
        {
            name: "Prev Close",
            ...(stocks[0] ? { [stocks[0].symbol]: parseFloat(stocks[0].price?.previousClose || 0) } : {}),
            ...(stocks[1] ? { [stocks[1].symbol]: parseFloat(stocks[1].price?.previousClose || 0) } : {}),
        },
        {
            name: "Current",
            ...(stocks[0] ? { [stocks[0].symbol]: parseFloat(stocks[0].price?.currentPrice || 0) } : {}),
            ...(stocks[1] ? { [stocks[1].symbol]: parseFloat(stocks[1].price?.currentPrice || 0) } : {}),
        },
    ] : [];

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h2 className="text-base font-semibold text-white mb-4">Stock Comparison</h2>

            {stocks.length < 2 && (
                <div className="relative mb-4">
                    <input type="text" value={query}
                           onChange={e => handleSearch(e.target.value)}
                           placeholder={`Add ${stocks.length === 0 ? "first" : "second"} stock...`}
                           className="w-full bg-slate-700 border border-slate-600 rounded-lg
                                      px-3 py-2 text-white text-sm focus:outline-none
                                      focus:border-blue-500" />
                    {results.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-10
                                        bg-slate-700 border border-slate-600 rounded-lg
                                        max-h-40 overflow-y-auto shadow-xl">
                            {results.map(s => (
                                <button key={s.id} onClick={() => addStock(s)}
                                        disabled={!!stocks.find(x => x.id === s.id)}
                                        className="w-full text-left px-3 py-2 hover:bg-slate-600
                                                   text-sm disabled:opacity-40">
                                    <span className="text-white font-medium">{s.symbol}</span>
                                    <span className="text-slate-400 ml-2">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {stocks.length > 0 && (
                <div className="flex gap-3 mb-4 flex-wrap">
                    {stocks.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 bg-slate-700
                                                    rounded-lg px-3 py-2 text-sm">
                            <div className="w-2 h-2 rounded-full"
                                 style={{ backgroundColor: COLORS[i] }} />
                            <span className="text-white font-medium">{s.symbol}</span>
                            {s.price && (
                                <>
                                    <span className="text-slate-400">
                                        {fmt(s.price.currentPrice)}
                                    </span>
                                    <span className={parseFloat(s.price.changePercent) >= 0
                                        ? "text-green-400" : "text-red-400"}>
                                        {parseFloat(s.price.changePercent) >= 0 ? "+" : ""}
                                        {parseFloat(s.price.changePercent).toFixed(2)}%
                                    </span>
                                </>
                            )}
                            <button onClick={() => removeStock(s.id)}
                                    className="text-slate-500 hover:text-white ml-1">✕</button>
                        </div>
                    ))}
                </div>
            )}

            {stocks.length === 2 ? (
                <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                        <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }}
                               tickFormatter={v => `₹${v.toLocaleString("en-IN")}`} />
                        <Tooltip formatter={(val) => fmt(val)}
                                 contentStyle={{ background: "#1e293b", border: "1px solid #334155",
                                     borderRadius: "8px", color: "#f1f5f9" }} />
                        <Legend />
                        {stocks.map((s, i) => (
                            <Line key={s.symbol} type="monotone" dataKey={s.symbol}
                                  stroke={COLORS[i]} strokeWidth={2}
                                  dot={{ fill: COLORS[i], r: 4 }} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <p className="text-slate-400 text-sm text-center py-8">
                    Search for up to 2 stocks to compare.
                </p>
            )}
        </div>
    );
}