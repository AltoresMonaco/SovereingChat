import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Download, Users, Activity, CheckCircle, XCircle, FileText } from 'lucide-react';
import { useAuthContext } from '~/hooks/AuthContext';
import { useNavigate } from 'react-router-dom';

type Lead = {
    _id?: string;
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
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const { user, isAuthenticated } = useAuthContext();
    const navigate = useNavigate();

    const fetchData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/admin/event/mcbusiness2k25/summary', {
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok) {
                setAttempts(data.attempts || 0);
                setLeads(Array.isArray(data.leads) ? data.leads : []);
            } else {
                if (res.status === 403 || res.status === 401) {
                    setStatus('Accès non autorisé. Vous devez être administrateur.');
                    navigate('/login');
                } else {
                    setStatus(data?.error || 'Erreur lors du chargement des données');
                }
            }
        } catch (err) {
            setStatus('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [navigate]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }
        fetchData();
    }, [isAuthenticated, fetchData, navigate]);

    // Auto-refresh every 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchData(false);
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchData(false);
    };

    const handleExportCSV = () => {
        const headers = ['Date', 'Prénom', 'Nom', 'Email', 'Usage', 'Consent Transactionnel', 'Consent Marketing'];
        const rows = leads.map(l => [
            new Date(l.createdAt).toLocaleString('fr-FR'),
            l.first_name,
            l.last_name,
            l.email,
            l.use_case || '',
            l.consent_transactional ? 'Oui' : 'Non',
            l.consent_marketing ? 'Oui' : 'Non'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `mcbusiness2k25_leads_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate statistics
    const stats = {
        totalLeads: leads.length,
        withMarketing: leads.filter(l => l.consent_marketing).length,
        withUseCase: leads.filter(l => l.use_case && l.use_case.trim()).length,
        successRate: attempts > 0 ? ((leads.length / attempts) * 100).toFixed(1) : '0'
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-surface-primary">
                <div className="text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-text-secondary">Chargement des données...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-primary p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
                            Admin · MCBusiness2K25
                        </h1>
                        <p className="mt-1 text-sm text-text-secondary">
                            Tableau de bord des inscriptions
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 rounded-md bg-surface-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Actualiser
                        </button>
                        <button
                            onClick={handleExportCSV}
                            disabled={leads.length === 0}
                            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Download className="h-4 w-4" />
                            Exporter CSV
                        </button>
                    </div>
                </div>

                {status && (
                    <div className="mb-6 rounded-md bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
                        {status}
                    </div>
                )}

                {/* Statistics Cards */}
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2">
                                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Tentatives QCM</p>
                                <p className="text-2xl font-bold text-text-primary">{attempts}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                                <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Leads collectés</p>
                                <p className="text-2xl font-bold text-text-primary">{stats.totalLeads}</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-2">
                                <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Taux de conversion</p>
                                <p className="text-2xl font-bold text-text-primary">{stats.successRate}%</p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-2">
                                <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                            </div>
                            <div>
                                <p className="text-sm text-text-secondary">Avec cas d'usage</p>
                                <p className="text-2xl font-bold text-text-primary">{stats.withUseCase}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border border-border-light bg-surface-primary-alt overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border-light bg-surface-tertiary">
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                                        Prénom
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                                        Nom
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary hidden lg:table-cell">
                                        Usage
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                                        Consent T.
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                                        Consent M.
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light">
                                {leads.map((lead, index) => (
                                    <tr key={lead._id || index} className="hover:bg-surface-hover transition-colors">
                                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                                            {new Date(lead.createdAt).toLocaleString('fr-FR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-text-primary">
                                            {lead.first_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-text-primary">
                                            {lead.last_name}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-text-primary">
                                            <a href={`mailto:${lead.email}`} className="hover:text-blue-600 transition-colors">
                                                {lead.email}
                                            </a>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-text-secondary hidden lg:table-cell">
                                            <div className="max-w-xs truncate" title={lead.use_case}>
                                                {lead.use_case || '-'}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {lead.consent_transactional ? (
                                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400 mx-auto" />
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {lead.consent_marketing ? (
                                                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 mx-auto" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-gray-400 dark:text-gray-600 mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {leads.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                                            <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                            <p>Aucun lead collecté pour le moment</p>
                                            <p className="text-sm mt-1">Les données apparaîtront ici dès qu'un utilisateur aura complété le formulaire.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer info */}
                <div className="mt-4 text-center text-xs text-text-tertiary">
                    Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR')} · Actualisation automatique toutes les 30 secondes
                </div>
            </div>
        </div>
    );
}