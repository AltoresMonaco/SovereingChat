import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';

export default function EventRoute() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get('token');
    const [progress, setProgress] = useState<{ stands_scanned: string[]; count: number; required: number } | null>(null);
    const [already, setAlready] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [form, setForm] = useState({ email: '', company: '', seats: 1, consentTransactional: true, consentMarketing: false });
    const [voucherType, setVoucherType] = useState<'personal' | 'org'>('personal');
    const [allowedDomains, setAllowedDomains] = useState<string>('');
    const [activationURL, setActivationURL] = useState<string | null>(null);
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

    const onSubmit = async (e: any) => {
        e.preventDefault();
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
                setStatus('Lead saved');
                if (data.activation_url) setActivationURL(data.activation_url);
            } else {
                setStatus(data?.error || 'Invalid form');
            }
        } catch (e) {
            setStatus('Network error');
        }
    };

    const onIssueVoucher = async () => {
        try {
            const payload: any = { type: voucherType };
            if (voucherType === 'org') {
                payload.allowed_domains = allowedDomains
                    .split(',')
                    .map((d) => d.trim())
                    .filter(Boolean);
            }
            const res = await fetch('/api/event/issue-voucher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus(`Voucher créé: ${data.voucher_id}`);
            } else {
                setStatus(data?.error || 'Issue voucher failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    return (
        <div style={{ maxWidth: 560, margin: '32px auto', padding: 16 }}>
            <h2>Event Access</h2>
            {status && <div style={{ color: 'crimson', marginBottom: 12 }}>{status}</div>}
            {progress && (
                <div style={{ marginBottom: 16 }}>
                    <div>Progress: {progress.count}/{progress.required}</div>
                    <div>Scanned: {progress.stands_scanned.join(', ') || '-'}</div>
                    {already && <div>(Already scanned this stand)</div>}
                    {completed && <div>Completed! Please fill the form below.</div>}
                </div>
            )}
            <div style={{ marginBottom: 16 }}>
                <Link to="/event/qcm">Passer le QCM (substitution)</Link>
            </div>

            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 8 }}>
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
                <button type="submit">Submit</button>
            </form>
            <div style={{ marginTop: 12 }}>
                {activationURL && (
                    <div>
                        Lien d'activation: <code>{activationURL}</code>
                    </div>
                )}
            </div>

            <hr style={{ margin: '16px 0' }} />
            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Émettre un voucher</div>
                <label>
                    Type
                    <select value={voucherType} onChange={(e) => setVoucherType(e.target.value as any)}>
                        <option value="personal">Personnel</option>
                        <option value="org">Organisation</option>
                    </select>
                </label>
                {voucherType === 'org' && (
                    <label>
                        Domaines autorisés (séparés par des virgules)
                        <input type="text" value={allowedDomains} onChange={(e) => setAllowedDomains(e.target.value)} placeholder="ex: exemple.mc, exemple.com" />
                    </label>
                )}
                <button type="button" onClick={onIssueVoucher}>Émettre</button>
            </div>
        </div>
    );
}


