import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect }                    from "react";
import { ThemeProvider }   from "./context/ThemeContext";
import { AuthProvider }    from "./context/AuthContext";
import { ToastProvider }   from "./context/ToastContext";
import ProtectedRoute      from "./components/ProtectedRoute";
import Layout              from "./components/Layout";

// Auth pages
import LoginPage           from "./pages/LoginPage";
import RegisterPage        from "./pages/RegisterPage";

// Stocks section
import StocksMarketPage    from "./pages/StocksMarketPage";
import HoldingsPage        from "./pages/HoldingsPage";
import TransactionsPage    from "./pages/TransactionsPage";
import WatchlistPage       from "./pages/WatchlistPage";

// MF section
import MfMarketPage        from "./pages/MfMarketPage";
import MutualFundsPage     from "./pages/MutualFundsPage";

// Combined
import CombinedPortfolio   from "./pages/CombinedPortfolio";

import { getPortfolioSummary, getMfPortfolioSummary } from "./api/portfolio";

function AppShell() {
    const [portfolioSummary, setPortfolioSummary] = useState(null);

    // Fetch combined portfolio summary for the top bar
    useEffect(() => {
        const load = async () => {
            try {
                const [stockRes, mfRes] = await Promise.allSettled([
                    getPortfolioSummary(),
                    getMfPortfolioSummary(),
                ]);
                const stockVal  = stockRes.status  === "fulfilled"
                    ? parseFloat(stockRes.value.data?.totalCurrentValue  || 0) : 0;
                const mfVal     = mfRes.status     === "fulfilled"
                    ? parseFloat(mfRes.value.data?.totalCurrentValue     || 0) : 0;
                const stockCost = stockRes.status  === "fulfilled"
                    ? parseFloat(stockRes.value.data?.totalInvestment    || 0) : 0;
                const mfCost    = mfRes.status     === "fulfilled"
                    ? parseFloat(mfRes.value.data?.totalInvested         || 0) : 0;

                setPortfolioSummary({
                    totalValue: stockVal + mfVal,
                    totalPL:    (stockVal + mfVal) - (stockCost + mfCost),
                });
            } catch {}
        };
        load();
        // Refresh every 5 minutes
        const t = setInterval(load, 300_000);
        return () => clearInterval(t);
    }, []);

    return (
        <Layout portfolioSummary={portfolioSummary}>
            <Routes>
                {/* Default redirect */}
                <Route path="/"  element={<Navigate to="/stocks" replace />} />

                {/* ── STOCKS ── */}
                <Route path="/stocks"              element={<StocksMarketPage />} />
                <Route path="/stocks/holdings"     element={
                    <HoldingsPage defaultView="stocks" />
                } />
                <Route path="/stocks/transactions" element={<TransactionsPage />} />
                <Route path="/stocks/watchlist"    element={
                    <WatchlistPage defaultTab="stocks" />
                } />

                {/* ── MUTUAL FUNDS ── */}
                <Route path="/mf"              element={<MfMarketPage />} />
                <Route path="/mf/holdings"     element={
                    <HoldingsPage defaultView="mf" />
                } />
                <Route path="/mf/transactions" element={
                    <MutualFundsPage defaultTab="history" />
                } />
                <Route path="/mf/watchlist"    element={
                    <WatchlistPage defaultTab="mf" />
                } />

                {/* ── COMBINED ── */}
                <Route path="/portfolio" element={<CombinedPortfolio />} />

                {/* Legacy URLs — redirect to new structure */}
                <Route path="/holdings"       element={<Navigate to="/stocks/holdings"     replace />} />
                <Route path="/transactions"   element={<Navigate to="/stocks/transactions" replace />} />
                <Route path="/watchlist"      element={<Navigate to="/stocks/watchlist"    replace />} />
                <Route path="/mutual-funds"   element={<Navigate to="/mf"                  replace />} />
                <Route path="/dashboard"      element={<Navigate to="/stocks"             replace />} />

                {/* 404 */}
                <Route path="*" element={<Navigate to="/stocks" replace />} />
            </Routes>
        </Layout>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <ToastProvider>
                        <Routes>
                            {/* Public routes */}
                            <Route path="/login"    element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />

                            {/* Protected routes */}
                            <Route
                                path="/*"
                                element={
                                    <ProtectedRoute>
                                        <AppShell />
                                    </ProtectedRoute>
                                }
                            />
                        </Routes>
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}