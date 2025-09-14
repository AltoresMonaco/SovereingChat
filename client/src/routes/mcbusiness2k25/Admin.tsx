import { useEffect, useState } from 'react';

type Lead = {
    createdAt: string;
    first_name: string;
    last_name: string;
    email: string;
    use_case?: string;
    consent_transactional: boolean;
    consent_marketing: boolean;
};

export default function AdminMCBusiness2K25() {
    const [attempts, setAttempts] = useState<number>(0);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [status, setStatus] = useState<string | null>(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const res = await fetch('/api/admin/event/mcbusiness2k25/summary');
                const data = await res.json();
                if (!ignore) {
                    if (res.ok) {
                        setAttempts(data.attempts || 0);
                        setLeads(Array.isArray(data.leads) ? data.leads : []);
                    } else {
                        setStatus(data?.error || 'Chargement échoué');
                    }
                }
            } catch {
                if (!ignore) setStatus('Erreur réseau');
            }
        })();
        return () => { ignore = true; };
    }, []);

    return (
        <div className="mx-auto my-8 w-full max-w-3xl rounded-md border border-border-subtle bg-surface-primary p-6 text-text-primary">
            <h2 className="mb-4 text-2xl font-semibold">Admin · MCBusiness2K25</h2>
            {status && <div className="mb-3 text-sm text-destructive">{status}</div>}
            <div className="mb-4 text-sm">Nombre d’essais du QCM (1 question): <b>{attempts}</b></div>
            <div className="overflow-auto rounded border border-border-subtle">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-surface-secondary text-text-secondary">
                            <th className="px-3 py-2 text-left">Date</th>
                            <th className="px-3 py-2 text-left">Prénom</th>
                            <th className="px-3 py-2 text-left">Nom</th>
                            <th className="px-3 py-2 text-left">Email</th>
                            <th className="px-3 py-2 text-left">Usage</th>
                            <th className="px-3 py-2 text-left">Consent T.</th>
                            <th className="px-3 py-2 text-left">Consent M.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.map((l, i) => (
                            <tr key={i} className="border-t border-border-subtle">
                                <td className="px-3 py-2">{new Date(l.createdAt).toLocaleString()}</td>
                                <td className="px-3 py-2">{l.first_name}</td>
                                <td className="px-3 py-2">{l.last_name}</td>
                                <td className="px-3 py-2">{l.email}</td>
                                <td className="px-3 py-2">{l.use_case || ''}</td>
                                <td className="px-3 py-2">{l.consent_transactional ? 'Oui' : 'Non'}</td>
                                <td className="px-3 py-2">{l.consent_marketing ? 'Oui' : 'Non'}</td>
                            </tr>
                        ))}
                        {leads.length === 0 && (
                            <tr>
                                <td className="px-3 py-4 text-center text-text-secondary" colSpan={7}>Aucun lead pour le moment.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}


