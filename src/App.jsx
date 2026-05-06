import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import LoginPage       from "./pages/LoginPage";
import RegisterPage    from "./pages/RegisterPage";
import DashboardPage   from "./pages/DashboardPage";
import HoldingsPage    from "./pages/HoldingsPage";
import TransactionsPage from "./pages/TransactionsPage";
import WatchlistPage   from "./pages/WatchlistPage";
import Layout          from "./components/Layout";

function PrivateRoute({ children }) {
    const { isAuthenticated } = useAuth();
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
    return (
        <Routes>
            <Route path="/login"    element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={
                <PrivateRoute><Layout /></PrivateRoute>
            }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard"    element={<DashboardPage />} />
                <Route path="holdings"     element={<HoldingsPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="watchlist"    element={<WatchlistPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    );
}