'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2, Package, Search, CheckCircle, AlertTriangle } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/');
      return;
    }
    if (user?.role === 'admin') fetchData();
  }, [user, authLoading, statusFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsData, matchesData] = await Promise.all([
        adminApi.getStats() as Promise<AdminStats>,
        adminApi.getMatches(1, statusFilter) as Promise<{ matches: AdminMatch[] }>,
      ]);
      setStats(statsData);
      setMatches(matchesData.matches || []);
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

      {/* Match Review Table */}
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
                      <span className={`badge ${m.status === 'pending' ? 'badge-warning' : m.status === 'approved' ? 'badge-success' : 'badge-info'}`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {m.status === 'pending' || m.status === 'disputed' ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleApprove(m.id)} className="text-green-600 hover:text-green-800 font-medium text-xs">Approve</button>
                          <button onClick={() => handleReject(m.id)} className="text-red-600 hover:text-red-800 font-medium text-xs">Reject</button>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
