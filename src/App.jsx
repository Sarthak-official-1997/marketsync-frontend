import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect }     from "react";
import { ThemeProvider }   from "./context/ThemeContext";
import { AuthProvider }    from "./context/AuthContext";
import { ToastProvider }   from "./context/ToastContext";
import { useAuth }         from "./context/AuthContext";
import ProtectedRoute      from "./components/ProtectedRoute";
import Layout              from "./components/Layout";
import ErrorBoundary       from "./components/ErrorBoundary";
import { NotFoundPage }    from "./components/ErrorFallback";
import { getHomePath } from "./utils/homePreference";
import NotificationModal   from "./components/NotificationModal";
import LightNotificationToast from "./components/LightNotificationToast";
import WelcomeModal, { SetupChecklist } from "./components/WelcomeModal";
import PasskeyBlocker      from "./components/PasskeyBlocker";
import BuildBadge          from "./components/BuildBadge"; // DEV BUILD BADGE — remove before sharing
import HomePage            from "./pages/HomePage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import AdminClientViewPage    from "./pages/AdminClientViewPage";

// Admin pages
import AdminDashboardPage      from "./pages/AdminDashboardPage";
import AdminClientsPage        from "./pages/AdminClientsPage";
import AdminClientDetailPage   from "./pages/AdminClientDetailPage";
import AdminAnalyticsPage      from "./pages/AdminAnalyticsPage";
import AdminUserManagementPage from "./pages/AdminUserManagementPage";
import ClientTrackerPage       from "./pages/ClientTrackerPage";
import TrackedClientDetailPage from "./pages/TrackedClientDetailPage";
import ThreadPage from "./pages/ThreadPage";
import MyThreadPage from "./pages/MyThreadPage";

// Auth pages
import LoginPage           from "./pages/LoginPage";
import RegisterPage        from "./pages/RegisterPage";

// Stocks
import StocksMarketPage    from "./pages/StocksMarketPage";
import AlertsPage          from "./pages/AlertsPage";
import HoldingsPage        from "./pages/HoldingsPage";
import TransactionsPage    from "./pages/TransactionsPage";
import WatchlistPage       from "./pages/WatchlistPage";
import SettingsPage        from "./pages/SettingsPage";

// MF
import MfMarketPage        from "./pages/MfMarketPage";
import MutualFundsPage     from "./pages/MutualFundsPage";

// Combined
import CombinedPortfolio   from "./pages/CombinedPortfolio";

import { getPortfolioSummary, getMfPortfolioSummary } from "./api/portfolio";

import AdminAiReportPage from "./pages/AdminAiReportPage";

import { MfMarketProvider } from "./context/MfMarketContext";

//PWA mobile app
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import PwaUpdatePrompt  from "./components/PwaUpdatePrompt";


// -- Route guards --------------------------------------------------------------

function AdminRoute({ children }) {
    const { user } = useAuth();
    const location = useLocation();
    const locationKey = location.pathname;
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

// -- App shell ----------------------------------------------------------------─

function AppShell() {
    const location = useLocation();
    const navigate = useNavigate();
    const locationKey = location.pathname;

    const [portfolioSummary, setPortfolioSummary] = useState(null);
    const [pendingNotifs, setPendingNotifs] = useState([]);
    const [notifsChecked, setNotifsChecked] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    const [showChecklist, setShowChecklist] = useState(false);
    const { user, isCreator } = useAuth();

    // The "/" redirect and the logo link both only ever fire when something
    // actually NAVIGATES to "/" — but a plain browser reload keeps whatever
    // URL was already in the address bar. If someone was sitting on
    // "/stocks" from before they'd ever set a preference (the old
    // hardcoded default), reloading just reloads "/stocks" again — "/"
    // is never touched, so the preference-aware redirect never gets a
    // chance to run at all. This is a genuinely different case from "the
    // redirect is broken" — it's that reload doesn't go through the
    // redirect's entry point in the first place.
    //
    // This runs ONCE, only on the very first mount of the whole app, and
    // ONLY corrects the exact bare "/stocks" path specifically — not
    // "/stocks/holdings" or any deeper route — so it can never interfere
    // with someone deliberately reloading a specific page they're already
    // looking at. It exists purely to self-correct the one specific case
    // of "I'm on the old default because that's where I happened to be
    // sitting before I ever changed my preference."
    useEffect(() => {
        if (location.pathname !== "/stocks") return;
        const home = getHomePath(isCreator);
        if (home !== "/stocks") navigate(home, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore the exact page after a PwaUpdatePrompt-triggered reload.
    // PwaUpdatePrompt stashes the full path (pathname+search+hash) right
    // before forcing the reload, specifically because a plain reload was
    // sometimes landing on Home instead of staying put — some route guard
    // or redirect elsewhere apparently fires during that reload in a way
    // that doesn't preserve location, and chasing the exact mechanism
    // wasn't worth it when this fixes the actual symptom unconditionally:
    // whatever happened, land back exactly where the user was.
    useEffect(() => {
        const returnPath = sessionStorage.getItem("ms_pwa_return_path");
        if (!returnPath) return;
        sessionStorage.removeItem("ms_pwa_return_path");
        const current = location.pathname + location.search + location.hash;
        if (returnPath !== current) navigate(returnPath, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // CREATOR never sees onboarding nudges (Welcome modal, setup checklist,
    // or the stock-modal coachmark) on any device — Sarthak already knows
    // the app; these exist for genuinely new client accounts.
    useEffect(() => {
        if (!user || isCreator) return;
        const welcomeKey   = `ms_welcomed_${user.id || user.username}`;
        const checklistKey = `ms_checklist_dismissed_${user.id || user.username}`;
        if (user?.firstLogin && !localStorage.getItem(welcomeKey)) {
            setShowWelcome(true);
        } else if (localStorage.getItem(welcomeKey) && !localStorage.getItem(checklistKey)) {
            setShowChecklist(true);
        }
    }, [user?.id, isCreator]);

    useEffect(() => {
        if (!user) return;
        import("./api/admin").then(({ getPendingNotifications }) => {
            getPendingNotifications()
                .then(notifs => {
                    setPendingNotifs(notifs || []);
                    setNotifsChecked(true);
                })
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
                const mfVal     = mfRes.status === "fulfilled"
                    ? parseFloat(mfRes.value.data?.totalCurrentValue    || 0) : 0;
                const stockCost = stockRes.status === "fulfilled"
                    ? parseFloat(stockRes.value.data?.totalInvestment   || 0) : 0;
                const mfCost    = mfRes.status === "fulfilled"
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
        // PasskeyBlocker wraps everything — blurs the UI and forces
        // passkey setup for CLIENT users who haven't done it yet.
        // ADMIN and CREATOR are exempt (handled inside PasskeyBlocker).
        <PasskeyBlocker>
            <Layout portfolioSummary={portfolioSummary}>
                <Routes>
                    {/* Reads the preference fresh on every visit to "/" — Mutual Funds-first
                        goes straight to MF holdings (not the fund marketplace), matching the
                        "personal tracking, not browsing" requirement. Client Tracker is
                        creator-only in Settings, but a stored preference could theoretically
                        go stale (e.g. a demoted account on a shared device) — isCreator is
                        checked again here as the real gate, not just trusted from storage,
                        so a non-creator never gets redirected toward a page that would just
                        403 on them. */}
                    <Route path="/" element={
                        <Navigate to={getHomePath(isCreator)} replace />
                    } />

                    {/* -- ADMIN -- */}
                    <Route path="/admin" element={
                        <AdminRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Admin dashboard failed to load">
                                <AdminDashboardPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/clients" element={
                        <AdminRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Client list failed to load">
                                <AdminClientsPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/clients/:clientId" element={
                        <AdminRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Client detail failed to load">
                                <AdminClientDetailPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/analytics" element={
                        <AdminRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Analytics failed to load">
                                <AdminAnalyticsPage />
                            </ErrorBoundary>
                        </AdminRoute>
                    } />
                    <Route path="/admin/users" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="User management failed to load">
                                <AdminUserManagementPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />
                    <Route path="/creator/client-tracker" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Client tracker failed to load">
                                <ClientTrackerPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />
                    <Route path="/creator/client-tracker/:id" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Client tracker failed to load">
                                <TrackedClientDetailPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    <Route path="/creator/client-tracker/:id/thread" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Thread failed to load">
                                <ThreadPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    <Route path="/my-thread" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Thread failed to load">
                            <MyThreadPage />
                        </ErrorBoundary>
                    } />

                    {/* -- HOME -- a real dashboard, separate from Stocks Market */}
                    <Route path="/home" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Home failed to load">
                            <HomePage />
                        </ErrorBoundary>
                    } />

                    {/* -- STOCKS -- */}
                    <Route path="/stocks" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Stock market failed to load">
                            <StocksMarketPage />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/holdings" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Holdings failed to load">
                            <HoldingsPage defaultView="stocks" />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/transactions" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Transactions failed to load">
                            <TransactionsPage />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/watchlist" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Watchlist failed to load">
                            <WatchlistPage defaultTab="stocks" />
                        </ErrorBoundary>
                    } />
                    <Route path="/stocks/alerts" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Alerts failed to load">
                            <AlertsPage />
                        </ErrorBoundary>
                    } />

                    {/* -- MUTUAL FUNDS -- */}
                    <Route path="/mf" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="MF market failed to load">
                            <MfMarketPage />
                        </ErrorBoundary>
                    } />
                    <Route path="/mf/holdings" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="MF holdings failed to load">
                            <HoldingsPage defaultView="mf" />
                        </ErrorBoundary>
                    } />
                    <Route path="/mf/transactions" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="MF transactions failed to load">
                            <MutualFundsPage defaultTab="history" />
                        </ErrorBoundary>
                    } />
                    <Route path="/mf/watchlist" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="MF watchlist failed to load">
                            <WatchlistPage defaultTab="mf" />
                        </ErrorBoundary>
                    } />

                    {/* -- COMBINED -- */}
                    <Route path="/portfolio" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Combined portfolio failed to load">
                            <CombinedPortfolio />
                        </ErrorBoundary>
                    } />

                    {/* -- SETTINGS -- */}
                    <Route path="/settings" element={
                        <ErrorBoundary locationKey={locationKey} fallbackTitle="Settings failed to load">
                            <SettingsPage />
                        </ErrorBoundary>
                    } />

                    {/* -- NOTIFICATIONS (CREATOR only) -- */}
                    <Route path="/admin/notifications" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Notifications failed to load">
                                <AdminNotificationsPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    {/* -- CLIENT VIEW / IMPERSONATION (CREATOR only) -- */}
                    <Route path="/admin/clients/:clientId/view" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="Client view failed to load">
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

                    {/* -- AI REPORT (CREATOR only) -- */}
                    <Route path="/admin/ai-report" element={
                        <CreatorRoute>
                            <ErrorBoundary locationKey={locationKey} fallbackTitle="AI report failed to load">
                                <AdminAiReportPage />
                            </ErrorBoundary>
                        </CreatorRoute>
                    } />

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Layout>

            {/* Split by requiresAck: genuine Creator broadcasts still block the app
                (NotificationModal, unchanged). Personal reminders and price
                alerts (requiresAck: false) get a small dismissible toast instead
                — they were previously funneled through the SAME blocking modal,
                which made "you set a reminder for yourself" read as if Sarthak
                was broadcasting you a message you had to formally acknowledge. */}
            {notifsChecked && pendingNotifs.filter(n => n.requiresAck).length > 0 && (
                <NotificationModal
                    notifications={pendingNotifs.filter(n => n.requiresAck)}
                    onAllAcknowledged={() =>
                        setPendingNotifs(prev => prev.filter(n => !n.requiresAck))}
                />
            )}
            {notifsChecked && (
                <LightNotificationToast
                    notifications={pendingNotifs.filter(n => !n.requiresAck)}
                    onDismissed={(recipientId) =>
                        setPendingNotifs(prev => prev.filter(n => n.recipientId !== recipientId))}
                />
            )}

            {showChecklist && (
                <SetupChecklist
                    user={user}
                    onDismiss={() => {
                        const key = `ms_checklist_dismissed_${user?.id || user?.username}`;
                        localStorage.setItem(key, "1");
                        setShowChecklist(false);
                    }}
                />
            )}

            {showWelcome && (
                <WelcomeModal
                    user={user}
                    onClose={() => {
                        const key = `ms_welcomed_${user?.id || user?.username}`;
                        localStorage.setItem(key, "1");
                        setShowWelcome(false);
                        setShowChecklist(true);
                    }}
                />
            )}
        </PasskeyBlocker>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <ToastProvider>
                    <MfMarketProvider>
                        <BuildBadge />        {/* DEV BUILD BADGE — remove before sharing */}
                        <PwaInstallPrompt />   {/* ADDed THIS */}
                        <PwaUpdatePrompt />    {/* new-build "Refresh" toast */}
                        <ErrorBoundary>
                            <Routes>
                                <Route path="/login"    element={<LoginPage />} />
                                <Route path="/register" element={<RegisterPage />} />
                                <Route path="/*" element={
                                    <ProtectedRoute><AppShell /></ProtectedRoute>
                                } />
                            </Routes>
                        </ErrorBoundary>
                    </MfMarketProvider>
                </ToastProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}