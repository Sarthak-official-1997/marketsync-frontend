export default function ErrorMessage({ message }) {
    return (
        <div className="bg-red-900/30 border border-red-500/50 text-red-300
                        rounded-lg p-4 text-sm">
            ⚠️ {message}
        </div>
    );
}