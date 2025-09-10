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
    const [visitorType, setVisitorType] = useState<'individual' | 'org'>('individual');
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
        // basic front validation
        const emailOk = /.+@.+\..+/.test(form.email);
        if (!emailOk) {
            setStatus('E‑mail invalide.');
            return;
        }
        if (!form.company?.trim()) {
            setStatus('Renseignez votre entreprise.');
            return;
        }
        if (form.seats < 1 || form.seats > 10) {
            setStatus('Nombre de sièges doit être entre 1 et 10.');
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

            <div className="mb-2 text-sm">Vous êtes&nbsp;:</div>
            <div className="mb-4 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                    <input type="radio" name="visitorType" checked={visitorType === 'individual'} onChange={() => setVisitorType('individual')} /> Particulier
                </label>
                <label className="flex items-center gap-2">
                    <input type="radio" name="visitorType" checked={visitorType === 'org'} onChange={() => setVisitorType('org')} /> Entreprise
                </label>
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
                {visitorType === 'org' && (
                    <label>
                        Sièges (1..5)
                        <input type="number" min={1} max={5} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
                    </label>
                )}
                <label>
                    <input type="checkbox" checked={form.consentTransactional} onChange={(e) => setForm({ ...form, consentTransactional: e.target.checked })} /> Transactional consent
                </label>
                <label>
                    <input type="checkbox" checked={form.consentMarketing} onChange={(e) => setForm({ ...form, consentMarketing: e.target.checked })} /> Marketing consent (optional)
                </label>
                <button type="submit" disabled={!progress?.eligible}>Enregistrer mes infos</button>
            </form>
            {visitorType === 'individual' ? (
                <div className="mt-4 border-t border-border-subtle pt-4">
                    <button type="button" onClick={onIssueCode} disabled={!progress?.eligible || !form.email}>Recevoir mon code</button>
                    {code && (
                        <div className="mt-2 text-sm">
                            Votre code: <code>{code}</code> — utilisez‑le sur la page d’inscription.
                            <div className="mt-1">
                                <Link to="/signup/code">Aller à la page d’inscription</Link>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="mt-4 border-t border-border-subtle pt-4">
                    <OrgVoucherRequest email={form.email} seats={form.seats} eligible={!!progress?.eligible} />
                </div>
            )}
        </div>
    );
}

function OrgVoucherRequest({ email, seats, eligible }: { email: string; seats: number; eligible: boolean }) {
    const [status, setStatus] = useState<string | null>(null);
    const [result, setResult] = useState<{ voucher_id: string; max_seats: number } | null>(null);
    const onRequest = async () => {
        try {
            if (!eligible) { setStatus('Complétez 2/2 ou QCM.'); return; }
            const res = await fetch('/api/event/request-org-voucher', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, seats })
            });
            const data = await res.json();
            if (res.ok) { setResult({ voucher_id: data.voucher_id, max_seats: data.max_seats }); setStatus('Voucher org créé.'); }
            else setStatus(data?.error || 'Échec de la demande');
        } catch { setStatus('Network error'); }
    };
    return (
        <div className="grid gap-2 text-sm">
            <div>Demande d’accès organisation (e‑mail pro requis, sièges ≤ 5).</div>
            <button type="button" onClick={onRequest} disabled={!eligible || !email}>Demander mon voucher org</button>
            {status && <div>{status}</div>}
            {result && <div>Voucher: <code>{result.voucher_id}</code> · seats: {result.max_seats}</div>}
        </div>
    );
}


