import { useEffect, useState } from 'react';

export default function OrgEvent() {
    const [voucherId, setVoucherId] = useState('');
    const [data, setData] = useState<any>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [domains, setDomains] = useState<string>('');

    const load = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/event/voucher/${id}`);
            const body = await res.json();
            if (res.ok) {
                setData(body);
                setDomains((body?.voucher?.allowed_domains || []).join(', '));
            } else {
                setStatus(body?.error || 'Load failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    const onRevoke = async (seat_id: string) => {
        try {
            const res = await fetch('/api/admin/event/seat/revoke', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seat_id }),
            });
            const body = await res.json();
            if (res.ok) {
                setStatus('Seat revoked');
                load(voucherId);
            } else {
                setStatus(body?.error || 'Revoke failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    const onUpdateDomains = async () => {
        try {
            const res = await fetch('/api/admin/event/voucher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voucher_id: voucherId, update: { allowed_domains: domains.split(',').map((d) => d.trim()).filter(Boolean) } }),
            });
            const body = await res.json();
            if (res.ok) {
                setStatus('Domains updated');
                load(voucherId);
            } else {
                setStatus(body?.error || 'Update failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    return (
        <div style={{ maxWidth: 960, margin: '32px auto', padding: 16 }}>
            <h2>Org · Event</h2>
            {status && <div style={{ color: 'crimson', marginBottom: 12 }}>{status}</div>}
            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                <label>
                    Voucher ID
                    <input value={voucherId} onChange={(e) => setVoucherId(e.target.value)} placeholder="EVT_…" />
                </label>
                <button disabled={!voucherId} onClick={() => load(voucherId)}>Charger</button>
            </div>

            {data && (
                <>
                    <div style={{ marginBottom: 12 }}>
                        <div><strong>{data.voucher.voucher_id}</strong> · status: {data.voucher.status} · used/total: {data.used}/{data.total}</div>
                    </div>
                    <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                        <div style={{ fontWeight: 600 }}>Domaines autorisés</div>
                        <input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="ex: exemple.mc, exemple.com" />
                        <button onClick={onUpdateDomains}>Mettre à jour</button>
                    </div>
                    <div style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>Sièges</div>
                        {data.seats.map((s: any) => (
                            <div key={s.seat_id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8, display: 'flex', justifyContent: 'space-between' }}>
                                <div>{s.email} · {s.status} · {s.activated_at ? new Date(s.activated_at).toLocaleString() : '-'}</div>
                                {s.status === 'active' && <button onClick={() => onRevoke(s.seat_id)}>Revoke</button>}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}


