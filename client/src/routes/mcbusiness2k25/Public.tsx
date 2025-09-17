import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

export default function MCBusiness2K25() {
    const [question, setQuestion] = useState<{ id: string; stem: string; choices: { id: string; label: string }[] } | null>(null);
    const [choice, setChoice] = useState<string>('');
    const [passed, setPassed] = useState<boolean>(false);
    const [status, setStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [form, setForm] = useState({
        first_name: '',
        last_name: '',
        email: '',
        use_case: '',
        access: 'chat' as 'api' | 'chat' | 'both',
        consent_transactional: true,
        consent_marketing: false
    });
    const [submitted, setSubmitted] = useState<boolean>(false);

    // Check if already passed on mount (fetch question will set state; server enforces gate on submit)
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const res = await fetch('/api/event/mcbusiness2k25/question', { credentials: 'include' });
                const data = await res.json();
                if (!ignore && res.ok) {
                    setQuestion(data);
                }
            } catch {
                if (!ignore) setStatus('Erreur de connexion au serveur');
            }
        })();
        return () => { ignore = true; };
    }, []);

    // If not passed, ensure question is loaded (idempotent)
    useEffect(() => {
        if (!passed && !question) {
            let ignore = false;
            (async () => {
                try {
                    const res = await fetch('/api/event/mcbusiness2k25/question', { credentials: 'include' });
                    const data = await res.json();
                    if (!ignore && res.ok) {
                        setQuestion(data);
                    }
                } catch {
                    if (!ignore) setStatus('Erreur de connexion au serveur');
                }
            })();
            return () => { ignore = true; };
        }
    }, [passed, question]);

    const onAnswer = async () => {
        if (!choice) return;
        setStatus(null);
        setLoading(true);
        try {
            const res = await fetch('/api/event/mcbusiness2k25/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ choice }),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                if (data.correct) {
                    setPassed(true);
                    setStatus(null);
                } else {
                    setStatus('Mauvaise réponse. Retente ta chance.');
                }
            } else {
                setStatus(data?.error || 'Erreur lors de la validation');
            }
        } catch {
            setStatus('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (e: any) => {
        e.preventDefault();
        setStatus(null);

        const emailOk = /.+@.+\..+/.test(form.email);
        if (!emailOk) {
            setStatus('Adresse e-mail invalide');
            return;
        }
        if (!form.first_name.trim() || !form.last_name.trim()) {
            setStatus('Prénom et nom requis');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/event/pre-form', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                setSubmitted(true);
            } else {
                setStatus(data?.error || 'Erreur lors de l\'envoi du formulaire');
            }
        } catch {
            setStatus('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-surface-primary">
                <div className="w-full max-w-md">
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-8 text-center shadow-lg">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="mb-2 text-2xl font-bold text-text-primary">
                            Demande envoyée avec succès !
                        </h2>
                        <p className="mb-6 text-text-secondary">
                            Votre demande a bien été enregistrée et sera étudiée dans les plus brefs délais.
                        </p>
                        <div className="rounded-md bg-surface-tertiary p-4 text-left">
                            <h3 className="mb-2 text-sm font-semibold text-text-primary">Récapitulatif :</h3>
                            <div className="space-y-1 text-sm text-text-secondary">
                                <p><span className="font-medium">Nom :</span> {form.first_name} {form.last_name}</p>
                                <p><span className="font-medium">Email :</span> {form.email}</p>
                                {form.use_case && (
                                    <p><span className="font-medium">Usage :</span> {form.use_case}</p>
                                )}
                            </div>
                        </div>
                        <p className="mt-6 text-xs text-text-tertiary">
                            Vous recevrez une réponse à l'adresse email fournie.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-surface-primary">
            <div className="w-full max-w-md">
                <div className="rounded-lg border border-border-light bg-surface-primary-alt p-6 shadow-lg sm:p-8">
                    <h1 className="mb-6 text-center text-2xl font-bold text-text-primary sm:text-3xl">
                        MCBusiness2K25
                    </h1>

                    {status && (
                        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-600 dark:text-red-400">
                            {status}
                        </div>
                    )}

                    {!passed ? (
                        <div className="space-y-4">
                            <p className="text-text-secondary">
                                Bonjour, afin de pouvoir obtenir un accès, vous devez bien répondre à cette question :
                            </p>

                            <div className="rounded-md bg-surface-tertiary p-4">
                                <p className="font-semibold text-text-primary">
                                    {question?.stem || 'Chargement de la question...'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                {question?.choices?.map((c) => (
                                    <label
                                        key={c.id}
                                        className="flex cursor-pointer items-center gap-3 rounded-md border border-border-medium p-3 transition-colors hover:bg-surface-tertiary"
                                    >
                                        <input
                                            type="radio"
                                            name="gate"
                                            value={c.id}
                                            checked={choice === c.id}
                                            onChange={() => setChoice(c.id)}
                                            className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                                        />
                                        <span className="text-text-primary">{c.label}</span>
                                    </label>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={onAnswer}
                                disabled={!choice || loading}
                                className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? 'Validation...' : 'Valider'}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={onSubmit} className="space-y-4">
                            <p className="text-text-secondary">
                                Félicitations ! Veuillez maintenant renseigner vos informations.
                            </p>

                            <div className="space-y-3">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-text-primary">
                                        Accès souhaité
                                    </label>
                                    <select
                                        value={form.access}
                                        onChange={(e) => setForm({ ...form, access: e.target.value as 'api' | 'chat' | 'both' })}
                                        className="w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="chat">Chat souverain</option>
                                        <option value="api">Accès API</option>
                                        <option value="both">Les deux</option>
                                    </select>
                                    {form.access !== 'chat' && (
                                        <p className="mt-1 text-xs text-text-tertiary">
                                            Un e-mail professionnel est requis si vous choisissez l'accès API.
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-text-primary">
                                        Prénom *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.first_name}
                                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                                        required
                                        className="w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Jean"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-text-primary">
                                        Nom *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.last_name}
                                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                                        required
                                        className="w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Dupont"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-text-primary">
                                        E-mail professionnel *
                                    </label>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                                        required
                                        className="w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="jean.dupont@entreprise.com"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium text-text-primary">
                                        Votre usage prévu (optionnel)
                                    </label>
                                    <textarea
                                        value={form.use_case}
                                        onChange={(e) => setForm({ ...form, use_case: e.target.value })}
                                        rows={3}
                                        className="w-full rounded-md border border-border-medium bg-surface-primary px-3 py-2 text-text-primary placeholder-text-tertiary focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Décrivez comment vous comptez utiliser notre service..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.consent_transactional}
                                        onChange={(e) => setForm({ ...form, consent_transactional: e.target.checked })}
                                        className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-text-secondary">
                                        J'accepte de recevoir des communications transactionnelles (requis) *
                                    </span>
                                </label>

                                <label className="flex items-start gap-2">
                                    <input
                                        type="checkbox"
                                        checked={form.consent_marketing}
                                        onChange={(e) => setForm({ ...form, consent_marketing: e.target.checked })}
                                        className="mt-1 h-4 w-4 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-text-secondary">
                                        J'accepte de recevoir des communications marketing (optionnel)
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !form.consent_transactional}
                                className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {loading ? 'Envoi en cours...' : 'Envoyer ma demande'}
                            </button>

                            <p className="text-xs text-text-tertiary">
                                * Champs obligatoires
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}