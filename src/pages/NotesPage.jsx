// src/pages/NotesPage.jsx
// Dedicated /notes route — thin wrapper that shows the notes panel full-screen.
// Closing it navigates back.

import { useNavigate } from "react-router-dom";
import NotesPanel from "../components/NotesPanel";

export default function NotesPage() {
    const navigate = useNavigate();
    return <NotesPanel onClose={() => navigate(-1)} />;
}