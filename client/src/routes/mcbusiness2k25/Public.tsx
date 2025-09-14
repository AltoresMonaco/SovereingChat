import { useEffect, useState } from 'react';

export default function MCBusiness2K25() {
    const [question, setQuestion] = useState<{ id: string; stem: string; choices: { id: string; label: string }[] } | null>(null);
    const [choice, setChoice] = useState<string>('');
    const [passed, setPassed] = useState<boolean>(false);
    const [status, setStatus] = useState<string | null>(null);
    const [cooldownMs, setCooldownMs] = useState<number>(0);
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', use_case: '', consent_transactional: true, consent_marketing: false });
    const [submitted, setSubmitted] = useState<boolean>(false);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const res = await fetch('/api/event/mcbusiness2k25/question');
                const data = await res.json();
                if (!ignore) {
                    if (res.ok) setQuestion(data);
                    else setStatus(data?.error || 'Erreur de chargement');
                }
            } catch {
                if (!ignore) setStatus('Erreur réseau');
            }
        })();
        return () => { ignore = true; };
    }, []);

    const onAnswer = async () => {
        setStatus(null);
        try {
            const res = await fetch('/api/event/mcbusiness2k25/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
            const data = await res.json();
            if (res.ok) {
                if (data.correct) {
                    setPassed(true);
                } else {
                    setStatus('Mauvaise réponse.');
                    if (data.cooldown_ms) setCooldownMs(data.cooldown_ms);
                }
            } else {
                if (res.status === 429 && data.retry_after) {
                    setStatus(`Trop d’essais. Réessayez plus tard.`);
                } else {
                    setStatus(data?.error || 'Réponse refusée');
                }
            }
        } catch {
            setStatus('Erreur réseau');
        }
    };

    const onSubmit = async (e: any) => {
        e.preventDefault();
        setStatus(null);
        if (!passed) { setStatus('Veuillez d’abord répondre à la question.'); return; }
        const emailOk = /.+@.+\..+/.test(form.email);
        if (!emailOk) { setStatus('E‑mail invalide.'); return; }
        if (!form.first_name.trim() || !form.last_name.trim()) { setStatus('Prénom et nom requis.'); return; }
        try {
            const res = await fetch('/api/event/pre-form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            const data = await res.json();
            if (res.ok) {
                setSubmitted(true);
                setStatus('Votre demande a bien été envoyée. Nous allons étudier votre demande de prêt.');
            } else {
                setStatus(data?.error || 'Formulaire refusé');
            }
        } catch {
            setStatus('Erreur réseau');
        }
    };

    return (
        <div className="mx-auto my-8 w-full max-w-xl rounded-md border border-border-subtle bg-surface-primary p-6 text-text-primary">
            <h2 className="mb-4 text-2xl font-semibold">MCBusiness2K25</h2>
            {status && <div className="mb-3 text-sm text-destructive">{status}</div>}
            {!passed ? (
                <div className="grid gap-3">
                    <div>Bonjour, afin de pouvoir obtenir un accès, vous devez bien répondre à cette question&nbsp;:</div>
                    <div className="font-medium">{question?.stem || '...'}</div>
                    <div className="grid gap-2">
                        {question?.choices?.map((c) => (
                            <label key={c.id} className="flex items-center gap-2">
                                <input type="radio" name="gate" value={c.id} checked={choice === c.id} onChange={() => setChoice(c.id)} /> {c.label}
                            </label>
                        ))}
                    </div>
                    <button type="button" onClick={onAnswer} disabled={!choice}>
                        Valider
                    </button>
                </div>
            ) : (
                <form onSubmit={onSubmit} className="grid gap-3">
                    <div className="text-sm text-text-secondary">Merci. Veuillez renseigner vos informations.</div>
                    <label>
                        Prénom
                        <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                    </label>
                    <label>
                        Nom
                        <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                    </label>
                    <label>
                        E‑mail
                        <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                    </label>
                    <label>
                        Votre usage (optionnel)
                        <textarea value={form.use_case} onChange={(e) => setForm({ ...form, use_case: e.target.value })} rows={3} />
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.consent_transactional} onChange={(e) => setForm({ ...form, consent_transactional: e.target.checked })} /> Consentement transactionnel (requis)
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={form.consent_marketing} onChange={(e) => setForm({ ...form, consent_marketing: e.target.checked })} /> Consentement marketing (optionnel)
                    </label>
                    <button type="submit" disabled={submitted}>Envoyer</button>
                    {submitted && (
                        <div className="text-sm text-green-600">Votre demande a bien été envoyée et sera étudiée.</div>
                    )}
                </form>
            )}
        </div>
    );
}


