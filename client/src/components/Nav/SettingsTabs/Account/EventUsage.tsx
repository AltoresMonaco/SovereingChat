import { useEffect, useState } from 'react';

type Usage = { messages: number; tokens: number };
type Limits = { msgCap: number; tokenCap: number; usedMsgs: number; usedTokens: number; reset: string };

export default function EventUsage() {
    const [usage, setUsage] = useState<Usage | null>(null);
    const [limits, setLimits] = useState<Limits | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [u, l] = await Promise.all([
                    fetch('/api/user/me/usage').then((r) => r.json()),
                    fetch('/api/user/me/limits').then((r) => r.json()),
                ]);
                if (!ignore) {
                    setUsage(u);
                    setLimits(l);
                }
            } catch (_) { }
        })();
        return () => {
            ignore = true;
        };
    }, []);

    if (!usage || !limits) return null;

    const msgPct = Math.min(100, Math.round((limits.usedMsgs / Math.max(1, limits.msgCap)) * 100));
    const tokPct = Math.min(100, Math.round((limits.usedTokens / Math.max(1, limits.tokenCap)) * 100));

    return (
        <div className="rounded-md border border-border-subtle p-3">
            <div className="mb-2 text-base font-semibold">Event Usage</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                    <div className="mb-1">Messages: {limits.usedMsgs} / {limits.msgCap} ({msgPct}%)</div>
                    <div className="h-2 w-full rounded bg-surface-tertiary">
                        <div className="h-2 rounded bg-accent" style={{ width: `${msgPct}%` }} />
                    </div>
                </div>
                <div>
                    <div className="mb-1">Tokens: {limits.usedTokens} / {limits.tokenCap} ({tokPct}%)</div>
                    <div className="h-2 w-full rounded bg-surface-tertiary">
                        <div className="h-2 rounded bg-accent" style={{ width: `${tokPct}%` }} />
                    </div>
                </div>
            </div>
            <div className="mt-2 text-xs text-text-secondary">Daily reset: {new Date(limits.reset).toLocaleString()}</div>
        </div>
    );
}




