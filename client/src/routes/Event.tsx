import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

export default function EventRoute() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token');
    const [progress, setProgress] = useState<{ stands_scanned: string[]; count: number; required: number; eligible?: boolean } | null>(null);
    const [already, setAlready] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [form, setForm] = useState({ email: '', company: '', seats: 1, consentTransactional: true, consentMarketing: false });
    const [code, setCode] = useState<string | null>(null);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!token) return;
            try {
                const res = await fetch('/api/event/stamp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
                const data = await res.json();
                if (!ignore) {
                    if (res.ok) {
                        setProgress(data.progress);
                        setAlready(data.already_scanned);
                        setCompleted(data.completed);
                    } else {
                        setStatus(data?.error || 'Invalid token');
                    }
                }
            } catch (e) {
                if (!ignore) setStatus('Network error');
            }
        })();
        return () => { ignore = true; };
    }, [token]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const res = await fetch('/api/event/progress');
                const data = await res.json();
                if (!ignore && res.ok) setProgress(data);
            } catch { }
        })();
        return () => { ignore = true; };
    }, []);

    const onSubmit = async (e: any) => {
        e.preventDefault();
        if (!progress?.eligible) {
            setStatus('Complétez 2/2 ou passez le QCM avant de continuer.');
            return;
        }
        try {
            const res = await fetch('/api/event/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: form.email,
                    company: form.company,
                    seats_requested: form.seats,
                    consent_transactional: form.consentTransactional,
                    consent_marketing: form.consentMarketing,
                }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus('Coordonnées enregistrées. Vous pouvez demander votre code.');
            } else {
                setStatus(data?.error || 'Invalid form');
            }
        } catch (e) {
            setStatus('Network error');
        }
    };

    const onIssueCode = async () => {
        try {
            if (!form.email) {
                setStatus('Renseignez votre e‑mail.');
                return;
            }
            const res = await fetch('/api/event/issue-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: form.email }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus("Code délivré");
                if (data.code) setCode(data.code);
            } else {
                setStatus(data?.error || 'Issue code failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    return (
        <div className="mx-auto my-8 w-full max-w-xl rounded-md border border-border-subtle bg-surface-primary p-6 text-text-primary">
            <h2 className="mb-4 text-2xl font-semibold">Accès Événement</h2>
            {status && <div style={{ color: 'crimson', marginBottom: 12 }}>{status}</div>}
            {progress && (
                <div className="mb-4 text-sm">
                    <div>Progression: {progress.count}/{progress.required}</div>
                    <div>Stands scannés: {progress.stands_scanned.join(', ') || '-'}</div>
                    {progress.eligible ? (
                        <div className="text-green-600">Éligible — vous pouvez obtenir votre code.</div>
                    ) : (
                        <div className="text-text-secondary">Scannez les deux stands ou passez le QCM.</div>
                    )}
                </div>
            )}
            <div style={{ marginBottom: 16 }}>
                <Link to="/event/qcm">Passer le QCM (substitution)</Link>
            </div>

            <form onSubmit={onSubmit} className="grid gap-3">
                <label>
                    Email
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </label>
                <label>
                    Company
                    <input type="text" required value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                </label>
                <label>
                    Seats
                    <input type="number" min={1} max={10} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
                </label>
                <label>
                    <input type="checkbox" checked={form.consentTransactional} onChange={(e) => setForm({ ...form, consentTransactional: e.target.checked })} /> Transactional consent
                </label>
                <label>
                    <input type="checkbox" checked={form.consentMarketing} onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })} /> Marketing consent (optional)
                </label>
                <button type="submit" disabled={!progress?.eligible}>Enregistrer mes infos</button>
            </form>
            <div className="mt-4 border-t border-border-subtle pt-4">
                <button type="button" onClick={onIssueCode} disabled={!progress?.eligible || !form.email}>Recevoir mon code</button>
                {code && (
                    <div className="mt-2 text-sm">
                        Votre code: <code>{code}</code> — utilisez‑le sur la page d’inscription.
                    </div>
                )}
            </div>
        </div>
    );
}


