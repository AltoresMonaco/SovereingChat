import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EventSignupCode() {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/auth/validate-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json();
            if (res.ok && data.activated) {
                setStatus('Accès activé. Redirection…');
                setTimeout(() => navigate('/c/new', { replace: true }), 700);
            } else {
                setStatus(data?.error || 'Code invalide ou expiré');
            }
        } catch (_) {
            setStatus('Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mx-auto my-8 w-full max-w-xl rounded-md border border-border-subtle bg-surface-primary p-6 text-text-primary">
            <h2 className="mb-4 text-2xl font-semibold">Inscription par code</h2>
            {status && <div className="mb-3 text-sm text-red-500">{status}</div>}
            <form onSubmit={onSubmit} className="grid gap-3">
                <label className="grid gap-1 text-sm">
                    E‑mail professionnel
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <label className="grid gap-1 text-sm">
                    Code de validation
                    <input type="text" required value={code} onChange={(e) => setCode(e.target.value)} />
                </label>
                <button type="submit" disabled={loading}>
                    {loading ? 'Validation…' : "Valider et activer l'accès"}
                </button>
            </form>
        </div>
    );
}


