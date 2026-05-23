import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect }     from "react";
import { ThemeProvider }   from "./context/ThemeContext";
import { AuthProvider }    from "./context/AuthContext";
import { ToastProvider }   from "./context/ToastContext";
import { useAuth }         from "./context/AuthContext";
import ProtectedRoute      from "./components/ProtectedRoute";
import Layout              from "./components/Layout";
import ErrorBoundary       from "./components/ErrorBoundary";
import { NotFoundPage }    from "./components/ErrorFallback";
import NotificationModal    from "./components/NotificationModal";
import WelcomeModal       from "./components/WelcomeModal";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import AdminClientViewPage    from "./pages/AdminClientViewPage";

// Admin pages
import AdminDashboardPage      from "./pages/AdminDashboardPage";
import AdminClientsPage        from "./pages/AdminClientsPage";
import AdminClientDetailPage   from "./pages/AdminClientDetailPage";
import AdminAnalyticsPage      from "./pages/AdminAnalyticsPage";
import AdminUserManagementPage from "./pages/AdminUserManagementPage";

// Auth pages
import LoginPage           from "./pages/LoginPage";
import RegisterPage        from "./pages/RegisterPage";

// Stocks
import StocksMarketPage    from "./pages/StocksMarketPage";
import AlertsPage          from "./pages/AlertsPage";
import HoldingsPage        from "./pages/HoldingsPage";
import TransactionsPage    from "./pages/TransactionsPage";
import WatchlistPage       from "./pages/WatchlistPage";

// MF
import MfMarketPage        from "./pages/MfMarketPage";
import MutualFundsPage     from "./pages/MutualFundsPage";

// Combined
import CombinedPortfolio   from "./pages/CombinedPortfolio";

import { getPortfolioSummary, getMfPortfolioSummary } from "./api/portfolio";

// ── Route guards ──────────────────────────────────────────────────────────────

function AdminRoute({ children }) {
    const { user } = useAuth();
    if (!user || (user.role !== "ADMIN" && user.role !== "CREATOR"))
        return <Navigate to="/" replace />;
    return children;
}

function CreatorRoute({ children }) {
    const { user } = useAuth();
    if (!user || user.role !== "CREATOR")
        return <Navigate to="/admin" replace />;
    return children;
}

// ── App shell ─────────────────────────────────────────────────────────────────

function AppShell() {
    const [portfolioSummary,    setPortfolioSummary]    = useState(null);
    const [pendingNotifs,       setPendingNotifs]       = useState([]);
    const [notifsChecked,       setNotifsChecked]       = useState(false);
    const [showWelcome,         setShowWelcome]         = useState(false);
    const { user } = useAuth();
    useEffect(() => {
        if (user?.firstLogin) {
            setShowWelcome(true);
        }
    }, [user?.firstLogin]);

    // Check for pending notifications on login
    useEffect(() => {
        if (!user) return;
        import("./api/admin").then(({ getPendingNotifications }) => {
            getPendingNotifications()
                .then(notifs => { setPendingNotifs(notifs || []); setNotifsChecked(true); })
                .catch(() => setNotifsChecked(true));
        });
    }, [user?.id]);

    useEffect(() => {
        const load = async () => {
            try {
                const [stockRes, mfRes] = await Promise.allSettled([
                    getPortfolioSummary(),
                    getMfPortfolioSummary(),
                ]);
                const stockVal  = stockRes.status === "fulfilled"
                    ? parseFloat(stockRes.value.data?.totalCurrentValue || 0) : 0;
                const mfVal     = mfRes.status    === "fulfilled"
                    ? parseFloat(mfRes.value.data?.totalCurrentValue    || 0) : 0;
                const stockCost = stockRes.status === "fulfilled"
                    ? parseFloat(stockRes.value.data?.totalInvestment   || 0) : 0;
                const mfCost    = mfRes.status    === "fulfilled"
                    ? parseFloat(mfRes.value.data?.totalInvested        || 0) : 0;
                setPortfolioSummary({
                    totalValue: stockVal + mfVal,
                    totalPL:    (stockVal + mfVal) - (stockCost + mfCost),
                });
            } catch {}
        };
        load();
        const t = setInterval(load, 300_000);
        return () => clearInterval(t);
    }, []);

    return (
        <>
            <Layout portfolioSummary={portfolioSummary}>
                <Routes>
                    <Route path="/" element={<Navigate to="/stocks" replace />} />

                    {/* ── ADMIN ── */}
                    <Route path="/admin" element={
                        <AdminRoute>
                            {/* Each admin page gets its own boundary so one bad page
                            doesn't kill the whole admin section */}
                            <ErrorBoundary fallbackTitle="Admin dashboard failed to load">
                                <AdminDashboardPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/clients" element={
                        <AdminRoute>
                            <ErrorBoundary fallbackTitle="Client list failed to load">
                                <AdminClientsPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/clients/:clientId" element={
                        <AdminRoute>
                            <ErrorBoundary fallbackTitle="Client detail failed to load">
                                <AdminClientDetailPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/analytics" element={
                        <AdminRoute>
                            <ErrorBoundary fallbackTitle="Analytics failed to load">
                                <AdminAnalyticsPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/users" element={
                        <CreatorRoute>
                            <ErrorBoundary fallbackTitle="User management failed to load">
                                <AdminUserManagementPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    {/* ── STOCKS ── */}
                    <Route path="/stocks" element={
                        <ErrorBoundary fallbackTitle="Stock market failed to load">
                            <StocksMarketPage />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/holdings" element={
                        <ErrorBoundary fallbackTitle="Holdings failed to load">
                            <HoldingsPage defaultView="stocks" />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/transactions" element={
                        <ErrorBoundary fallbackTitle="Transactions failed to load">
                            <TransactionsPage />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/watchlist" element={
                        <ErrorBoundary fallbackTitle="Watchlist failed to load">
                            <WatchlistPage defaultTab="stocks" />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/alerts" element={
                        <ErrorBoundary fallbackTitle="Alerts failed to load">
                            <AlertsPage />
                        </ErrorBoundary>
                    } />

                    {/* ── MUTUAL FUNDS ── */}
                    <Route path="/mf" element={
                        <ErrorBoundary fallbackTitle="MF market failed to load">
                            <MfMarketPage />
                        </ErrorBoundary>
                    } />
                    <Route path="/mf/holdings" element={
                        <ErrorBoundary fallbackTitle="MF holdings failed to load">
                            <HoldingsPage defaultView="mf" />
                        </ErrorBoundary>
                    } />
                    <Route path="/mf/transactions" element={
                        <ErrorBoundary fallbackTitle="MF transactions failed to load">
                            <MutualFundsPage defaultTab="history" />
                        </ErrorBoundary>
                    } />
                    <Route path="/mf/watchlist" element={
                        <ErrorBoundary fallbackTitle="MF watchlist failed to load">
                            <WatchlistPage defaultTab="mf" />
                        </ErrorBoundary>
                    } />

                    {/* ── COMBINED ── */}
                    <Route path="/portfolio" element={
                        <ErrorBoundary fallbackTitle="Combined portfolio failed to load">
                            <CombinedPortfolio />
                        </ErrorBoundary>
                    } />

                    {/* ── NOTIFICATIONS (CREATOR only) ── */}
                    <Route path="/admin/notifications" element={
                        <CreatorRoute>
                            <ErrorBoundary fallbackTitle="Notifications failed to load">
                                <AdminNotificationsPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    {/* ── CLIENT VIEW / IMPERSONATION (CREATOR only) ── */}
                    <Route path="/admin/clients/:clientId/view" element={
                        <CreatorRoute>
                            <ErrorBoundary fallbackTitle="Client view failed to load">
                                <AdminClientViewPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    {/* Legacy redirects */}
                    <Route path="/holdings"     element={<Navigate to="/stocks/holdings"     replace />} />
                    <Route path="/transactions" element={<Navigate to="/stocks/transactions" replace />} />
                    <Route path="/watchlist"    element={<Navigate to="/stocks/watchlist"    replace />} />
                    <Route path="/mutual-funds" element={<Navigate to="/mf"                 replace />} />
                    <Route path="/dashboard"    element={<Navigate to="/stocks"             replace />} />

                    {/* 404 — shown for any unknown path */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Layout>
            {/* Notification modal — blocks UI until all messages acknowledged */}
            {notifsChecked && pendingNotifs.length > 0 && (
                <NotificationModal
                    notifications={pendingNotifs}
                    onAllAcknowledged={() => setPendingNotifs([])}
                />
            )}
            {showWelcome && (
                <WelcomeModal
                    user={user}
                    onClose={() => setShowWelcome(false)}
                />
            )}
        </>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <ToastProvider>
                    {/*
                      Outermost boundary — catches crashes in Layout, providers, etc.
                      This is the last line of defense. If this fires, the full-page
                      sorry screen is shown.
                    */}
                    <ErrorBoundary>
                        <Routes>
                            <Route path="/login"    element={<LoginPage />} />
                            <Route path="/register" element={<RegisterPage />} />
                            <Route path="/*" element={
                                <ProtectedRoute><AppShell /></ProtectedRoute>
                            } />
                        </Routes>
                    </ErrorBoundary>
                </ToastProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}