'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { reportsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Loader2, MapPin, Clock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportItem {
  id: string;
  category: string;
  brand?: string;
  colour?: string;
  description: string;
  location: string;
  event_time: string;
  photo_url?: string;
  status: string;
  created_at: string;
  type: 'lost' | 'found';
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [lostItems, setLostItems] = useState<ReportItem[]>([]);
  const [foundItems, setFoundItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchReports();
  }, [user, authLoading]);

  const fetchReports = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await reportsApi.getByUser(user.id) as { lost: ReportItem[]; found: ReportItem[] };
      setLostItems(data.lost || []);
      setFoundItems(data.found || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load reports';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/report/lost" className="btn-primary text-sm">+ Report Lost</Link>
          <Link href="/report/found" className="btn-secondary text-sm">+ Report Found</Link>
        </div>
      </div>

      {/* Lost Items */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4">Lost Items ({lostItems.length})</h2>
        {lostItems.length === 0 ? (
          <p className="text-gray-500">No lost items reported yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lostItems.map((item) => (
              <ReportCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Found Items */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Found Items ({foundItems.length})</h2>
        {foundItems.length === 0 ? (
          <p className="text-gray-500">No found items reported yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {foundItems.map((item) => (
              <ReportCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportCard({ item }: { item: ReportItem }) {
  const statusColours: Record<string, string> = {
    active: 'bg-blue-100 text-blue-700',
    matched: 'bg-yellow-100 text-yellow-700',
    verified: 'bg-green-100 text-green-700',
    returned: 'bg-purple-100 text-purple-700',
    closed: 'bg-gray-100 text-gray-500',
  };

  return (
    <Link
      href={`/matches/${item.id}?type=${item.type}`}
      className="card hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`badge ${statusColours[item.status] || 'bg-gray-100'}`}>
          {item.status}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
      </div>

      {item.photo_url && (
        <img src={item.photo_url} alt={item.category} className="w-full h-40 object-cover rounded-lg mb-3" />
      )}

      <h3 className="font-medium text-gray-900 capitalize">{item.category}</h3>
      <p className="text-sm text-gray-600 line-clamp-2 mt-1">{item.description}</p>

      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {item.location}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {new Date(item.event_time).toLocaleDateString()}
        </span>
      </div>
    </Link>
  );
}
