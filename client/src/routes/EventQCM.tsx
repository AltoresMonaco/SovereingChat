import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

type Question = { id: string; q: string; choices: string[] };
type QuestionsResponse = { session_id: string; questions: Question[] };

export default function EventQCM() {
    const [data, setData] = useState<QuestionsResponse | null>(null);
    const [answers, setAnswers] = useState<Record<string, number>>({});
    const [status, setStatus] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const res = await fetch('/api/event/qcm/questions');
                const body = await res.json();
                if (!ignore) {
                    if (res.ok) setData(body);
                    else setStatus(body?.error || 'Failed to load questions');
                }
            } catch (_) {
                if (!ignore) setStatus('Network error');
            }
        })();
        return () => {
            ignore = true;
        };
    }, []);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!data) return;
        setSubmitting(true);
        setStatus(null);
        try {
            const payload = {
                answers: Object.entries(answers).map(([id, choice]) => ({ id, choice })),
            };
            const res = await fetch('/api/event/qcm/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            if (res.ok) {
                if (body.passed) {
                    setStatus('Réussi ! Le QCM a validé un stand manquant.');
                    setTimeout(() => navigate('/event'), 800);
                } else {
                    setStatus(`Échec: ${body.correct}/${body.total} corrects.`);
                }
            } else {
                setStatus(body?.error || 'Submission failed');
            }
        } catch (_) {
            setStatus('Network error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: 720, margin: '32px auto', padding: 16 }}>
            <h2>QCM Monaco</h2>
            {status && <div style={{ color: status.startsWith('Réussi') ? 'green' : 'crimson', marginBottom: 12 }}>{status}</div>}
            {!data ? (
                <div>Chargement…</div>
            ) : (
                <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
                    {data.questions.map((q) => (
                        <div key={q.id} style={{ border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                            <div style={{ fontWeight: 600, marginBottom: 8 }}>{q.q}</div>
                            <div style={{ display: 'grid', gap: 6 }}>
                                {q.choices.map((c, idx) => (
                                    <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <input
                                            type="radio"
                                            name={q.id}
                                            value={idx}
                                            checked={answers[q.id] === idx}
                                            onChange={() => setAnswers((s) => ({ ...s, [q.id]: idx }))}
                                        />
                                        {c}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button type="submit" disabled={submitting}>Valider</button>
                        <button type="button" onClick={() => navigate('/event')}>Retour</button>
                    </div>
                </form>
            )}
        </div>
    );
}


