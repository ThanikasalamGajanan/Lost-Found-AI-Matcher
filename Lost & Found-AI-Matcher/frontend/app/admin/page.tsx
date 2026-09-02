'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi, DisputedMatch } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2, Package, Search, CheckCircle, AlertTriangle, Flag, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminStats {
  lost_items: { total: string; active: string };
  found_items: { total: string; active: string };
  matches: { total: string; pending: string; approved: string; disputed: string };
}

interface AdminMatch {
  id: string;
  total_score: number;
  status: string;
  fraud_flag: boolean;
  flag_reason: string | null;
  created_at: string;
  lost_id: string;
  lost_category: string;
  lost_desc: string;
  found_id: string;
  found_category: string;
  found_desc: string;
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [disputed, setDisputed] = useState<DisputedMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [tab, setTab] = useState<'matches' | 'fraud'>('matches');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      return;
    }
    if (user?.role === 'admin') fetchData();
  }, [user, authLoading, statusFilter, tab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, matchesData] = await Promise.all([
        adminApi.getStats() as Promise<AdminStats>,
        adminApi.getMatches(1, statusFilter) as Promise<{ matches: AdminMatch[] }>,
      ]);
      setStats(statsData);
      setMatches(matchesData.matches || []);

      if (tab === 'fraud') {
        const disputedData = await adminApi.getDisputed() as { matches: DisputedMatch[] };
        setDisputed(disputedData.matches || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await adminApi.approveMatch(id);
      toast.success('Match approved');
      fetchData();
    } catch { toast.error('Failed to approve'); }
  };

  const handleReject = async (id: string) => {
    try {
      await adminApi.rejectMatch(id);
      toast.success('Match rejected');
      fetchData();
    } catch { toast.error('Failed to reject'); }
  };

  const handleFlag = async (id: string) => {
    const reason = prompt('Reason for flagging this match as fraud:');
    if (!reason?.trim()) return;
    try {
      await adminApi.flagMatch(id, reason.trim());
      toast.success('Match flagged');
      fetchData();
    } catch { toast.error('Failed to flag'); }
  };

  const handleUnflag = async (id: string) => {
    try {
      await adminApi.unflagMatch(id);
      toast.success('Flag removed');
      fetchData();
    } catch { toast.error('Failed to unflag'); }
  };

  const handleMarkReturned = async (m: AdminMatch) => {
    try {
      await Promise.all([
        adminApi.updateItemStatus(m.lost_id, 'returned', 'lost', 'Item returned to owner'),
        adminApi.updateItemStatus(m.found_id, 'returned', 'found', 'Item returned to owner'),
      ]);
      toast.success('Items marked as returned');
      fetchData();
    } catch { toast.error('Failed to mark returned'); }
  };

  if (authLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="Lost Items" value={stats.lost_items.total} sub={`${stats.lost_items.active} active`} icon={<Package />} />
          <StatCard label="Found Items" value={stats.found_items.total} sub={`${stats.found_items.active} active`} icon={<Search />} />
          <StatCard label="Matches" value={stats.matches.total} sub={`${stats.matches.pending} pending`} icon={<CheckCircle />} />
          <StatCard label="Disputed" value={stats.matches.disputed} sub="Need review" icon={<AlertTriangle />} colour="text-red-600" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          className={`pb-3 px-2 text-sm font-medium border-b-2 transition ${tab === 'matches' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('matches')}
        >
          Match Review
        </button>
        <button
          className={`pb-3 px-2 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${tab === 'fraud' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setTab('fraud')}
        >
          <ShieldAlert className="w-4 h-4" />
          Fraud / Disputed
          {stats && parseInt(stats.matches.disputed) > 0 && (
            <span className="ml-1 bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{stats.matches.disputed}</span>
          )}
        </button>
      </div>

      {/* Match Review Table */}
      {tab === 'matches' && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Match Review</h2>
            <select
              className="input-field w-40"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="disputed">Disputed</option>
              <option value="">All</option>
            </select>
          </div>

          {matches.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No matches to review.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 pr-4">Score</th>
                    <th className="pb-3 pr-4">Lost Item</th>
                    <th className="pb-3 pr-4">Found Item</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-bold">{m.total_score}%</td>
                      <td className="py-3 pr-4">
                        <span className="font-medium capitalize">{m.lost_category}</span>
                        <p className="text-xs text-gray-500 line-clamp-1">{m.lost_desc}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-medium capitalize">{m.found_category}</span>
                        <p className="text-xs text-gray-500 line-clamp-1">{m.found_desc}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`badge ${m.status === 'pending' ? 'badge-warning' : m.status === 'approved' || m.status === 'returned' ? 'badge-success' : m.status === 'rejected' ? 'badge-danger' : 'badge-info'}`}>
                            {m.status}
                          </span>
                          {m.fraud_flag && (
                            <span className="badge badge-danger flex items-center gap-1">
                              <Flag className="w-3 h-3" /> flagged
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {(m.status === 'pending' || m.status === 'disputed') && (
                            <>
                              <button onClick={() => handleApprove(m.id)} className="text-green-600 hover:text-green-800 font-medium text-xs">Approve</button>
                              <button onClick={() => handleReject(m.id)} className="text-red-600 hover:text-red-800 font-medium text-xs">Reject</button>
                            </>
                          )}
                          {m.status === 'approved' && (
                            <button onClick={() => handleMarkReturned(m)} className="text-green-600 hover:text-green-800 font-medium text-xs">Mark Returned</button>
                          )}
                          {!m.fraud_flag && (
                            <button onClick={() => handleFlag(m.id)} className="text-amber-600 hover:text-amber-800 font-medium text-xs flex items-center gap-1">
                              <Flag className="w-3 h-3" /> Flag
                            </button>
                          )}
                          {m.fraud_flag && (
                            <button onClick={() => handleUnflag(m.id)} className="text-gray-500 hover:text-gray-700 font-medium text-xs">Unflag</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fraud / Disputed Tab */}
      {tab === 'fraud' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h2 className="text-xl font-semibold">Flagged &amp; Disputed Cases</h2>
          </div>

          {disputed.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No flagged or disputed cases.</p>
          ) : (
            <div className="space-y-6">
              {disputed.map((m) => (
                <div key={m.id} className="border rounded-lg p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${m.fraud_flag ? 'badge-danger' : 'badge-warning'}`}>
                          {m.fraud_flag ? 'Fraud flagged' : 'Disputed'}
                        </span>
                        <span className="text-xs text-gray-500">Score: {m.total_score}%</span>
                      </div>
                      {m.flag_reason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {m.flag_reason}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleApprove(m.id)} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Approve</button>
                      <button onClick={() => handleReject(m.id)} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">Reject</button>
                      {m.fraud_flag && (
                        <button onClick={() => handleUnflag(m.id)} className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300">Unflag</button>
                      )}
                      {!m.fraud_flag && (
                        <button onClick={() => handleFlag(m.id)} className="px-3 py-1 bg-amber-100 text-amber-700 text-xs rounded hover:bg-amber-200 flex items-center gap-1">
                          <Flag className="w-3 h-3" /> Flag
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Users */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Claimant</span>
                      <p>{m.claimant_name}</p>
                      <p className="text-xs text-gray-500">{m.claimant_email}</p>
                    </div>
                    <div>
                      <span className="font-medium">Finder</span>
                      <p>{m.finder_name}</p>
                      <p className="text-xs text-gray-500">{m.finder_email}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 rounded p-3">
                    <div>
                      <span className="font-medium capitalize">{m.lost_category}</span>
                      <p className="text-xs text-gray-600">{m.lost_desc}</p>
                    </div>
                    <div>
                      <span className="font-medium capitalize">{m.found_category}</span>
                      <p className="text-xs text-gray-600">{m.found_desc}</p>
                    </div>
                  </div>

                  {/* Verification History */}
                  {(m.questions.length > 0 || m.attempts.length > 0) && (
                    <div className="text-sm space-y-2">
                      <span className="font-medium">Verification History</span>
                      {m.questions.map((q) => (
                        <div key={q.id} className="bg-blue-50 rounded p-3">
                          <p className="text-xs font-medium text-blue-800">Q: {q.question_text}</p>
                          <p className="text-xs text-blue-600">Correct answer: {q.correct_answer}</p>
                        </div>
                      ))}
                      {m.attempts.map((a) => (
                        <div key={a.id} className={`rounded p-3 ${a.is_correct === true ? 'bg-green-50' : a.is_correct === false ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <p className="text-xs">
                            <span className="font-medium">Attempt #{a.attempt_number}:</span>{' '}
                            {a.answer_text}
                          </p>
                          <p className={`text-xs mt-1 ${a.is_correct === true ? 'text-green-700' : a.is_correct === false ? 'text-red-700' : 'text-gray-500'}`}>
                            {a.is_correct === true ? 'Correct' : a.is_correct === false ? 'Incorrect' : 'Pending judgment'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, colour }: {
  label: string; value: string; sub: string; icon: React.ReactNode; colour?: string;
}) {
  return (
    <div className="card">
      <div className={`flex items-center gap-2 ${colour || 'text-primary-600'} mb-2`}>
        {icon}
        <span className="text-sm font-medium text-gray-500">{label}</span>
      </div>
      <p className={`text-3xl font-bold ${colour || ''}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
