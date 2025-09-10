import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export default function EventActivation() {
    const { token } = useParams();
    const [data, setData] = useState<{ email: string; company: string; seats_requested: number } | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        let ignore = false;
        (async () => {
            if (!token) return;
            try {
                const res = await fetch(`/api/event/activation/${token}`);
                const body = await res.json();
                if (!ignore) {
                    if (res.ok) setData(body);
                    else setStatus(body?.error || 'Invalid or expired activation token');
                }
            } catch (_) {
                if (!ignore) setStatus('Network error');
            }
        })();
        return () => { ignore = true; };
    }, [token]);

    const onRedeem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const voucher_id = fd.get('voucher_id') as string;
        const email = fd.get('email') as string;
        try {
            const res = await fetch('/api/auth/redeem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voucher_id, email }),
            });
            const body = await res.json();
            if (res.ok) {
                setStatus('Seat activated');
                setTimeout(() => navigate('/c/new'), 800);
            } else {
                setStatus(body?.error || 'Activation failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    return (
        <div style={{ maxWidth: 560, margin: '32px auto', padding: 16 }}>
            <h2>Activation</h2>
            {status && <div style={{ color: status.includes('activated') ? 'green' : 'crimson', marginBottom: 12 }}>{status}</div>}
            {!data ? (
                <div>Chargement…</div>
            ) : (
                <form onSubmit={onRedeem} style={{ display: 'grid', gap: 8 }}>
                    <label>
                        Email
                        <input name="email" type="email" required defaultValue={data.email} />
                    </label>
                    <label>
                        Voucher ID
                        <input name="voucher_id" type="text" required placeholder="EVT_…" />
                    </label>
                    <button type="submit">Activer</button>
                    <button type="button" onClick={() => navigate('/event')}>Retour</button>
                </form>
            )}
        </div>
    );
}


