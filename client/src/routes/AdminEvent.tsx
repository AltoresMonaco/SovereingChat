import { useEffect, useState } from 'react';

type Voucher = { voucher_id: string; org_id: string; status: string };
type Usage = { org_id: string; date: string; tokens: number; messages?: number; by_model?: Record<string, { tokens: number; messages: number }> };

export default function AdminEvent() {
    const [vouchers, setVouchers] = useState<Voucher[]>([]);
    const [usage, setUsage] = useState<Usage[]>([]);
    const [funnel, setFunnel] = useState<{ stamps: number; leads: number; activations: number } | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [extendDays, setExtendDays] = useState<number>(14);
    const [maxSeats, setMaxSeats] = useState<number>(5);
    const [voucherId, setVoucherId] = useState('');

    const load = async () => {
        try {
            const res = await fetch('/api/admin/event/analytics');
            const data = await res.json();
            if (res.ok) {
                setVouchers(data.vouchers || []);
                setUsage(data.usage || []);
                setFunnel(data.funnel || null);
            } else {
                setStatus(data?.error || 'Failed to load analytics');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    useEffect(() => { load(); }, []);

    const onExportLeads = async () => {
        try {
            const res = await fetch('/api/admin/event/export-leads', { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setStatus(body?.error || 'Export failed');
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'leads.csv';
            a.click();
            URL.revokeObjectURL(url);
        } catch (_) {
            setStatus('Network error');
        }
    };

    const onExtend = async () => {
        try {
            const res = await fetch('/api/admin/event/extend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ voucher_id: voucherId, extend_days: extendDays, max_seats: maxSeats }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus('Voucher updated');
                load();
            } else {
                setStatus(data?.error || 'Extend failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    const onIssueQR = async (stand: 'A' | 'B') => {
        try {
            const res = await fetch('/api/admin/event/issue-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stand }),
            });
            const data = await res.json();
            if (res.ok) {
                navigator.clipboard?.writeText(`${window.location.origin}/event?token=${data.token}`);
                setStatus(`QR token issued for stand ${stand} (URL copied)`);
            } else {
                setStatus(data?.error || 'Issue QR failed');
            }
        } catch (_) {
            setStatus('Network error');
        }
    };

    return (
        <div style={{ maxWidth: 960, margin: '32px auto', padding: 16 }}>
            <h2>Admin · Event</h2>
            {status && <div style={{ color: 'crimson', marginBottom: 12 }}>{status}</div>}

            <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Funnel (aujourd’hui)</div>
                <div>Scans: {funnel?.stamps ?? 0} · Leads: {funnel?.leads ?? 0} · Activations: {funnel?.activations ?? 0}</div>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Export</div>
                <button onClick={onExportLeads}>Exporter les leads (CSV)</button>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Issue QR</div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => onIssueQR('A')}>Stand A</button>
                    <button onClick={() => onIssueQR('B')}>Stand B</button>
                </div>
            </div>

            <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>Extend voucher</div>
                <label>
                    Voucher ID
                    <input value={voucherId} onChange={(e) => setVoucherId(e.target.value)} placeholder="EVT_…" />
                </label>
                <label>
                    Extension (jours)
                    <input type="number" min={1} value={extendDays} onChange={(e) => setExtendDays(Number(e.target.value))} />
                </label>
                <label>
                    Max seats
                    <input type="number" min={1} value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))} />
                </label>
                <button onClick={onExtend} disabled={!voucherId}>Mettre à jour</button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontWeight: 600 }}>Vouchers</div>
                <div style={{ display: 'grid', gap: 6 }}>
                    {vouchers.map((v) => (
                        <div key={v.voucher_id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 8 }}>
                            <div><strong>{v.voucher_id}</strong> · org: {v.org_id} · status: {v.status}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


