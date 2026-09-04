'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { reportsApi, type ReportResponse } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { MapPin, Clock, ChevronRight, PackageOpen, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

type Tab = 'lost' | 'found';

interface DashboardItem {
  id: string;
  category: string;
  brand: string | null;
  colour: string | null;
  description: string;
  location: string;
  photo_url: string | null;
  status: string;
  created_at: string;
  event_time: string;
  type: 'lost' | 'found';
}

const statusColours: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700',
  matched: 'bg-yellow-100 text-yellow-700',
  verified: 'bg-green-100 text-green-700',
  returned: 'bg-purple-100 text-purple-700',
  closed: 'bg-gray-100 text-gray-500',
};

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('lost');
  const [lostItems, setLostItems] = useState<DashboardItem[]>([]);
  const [foundItems, setFoundItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await reportsApi.getByUser(user.id);
      setLostItems(normalizeReports(data.lost || [], 'lost'));
      setFoundItems(normalizeReports(data.found || [], 'found'));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load reports';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) fetchReports();
  }, [user, authLoading, router, fetchReports]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const currentItems = activeTab === 'lost' ? lostItems : foundItems;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <div className="flex gap-3">
          <Link href="/report/lost" className="btn-primary text-sm">+ Report Lost</Link>
          <Link href="/report/found" className="btn-secondary text-sm">+ Report Found</Link>
        </div>
      </div>

      <div className="flex border-b border-gray-200 mb-6">
        <TabButton
          active={activeTab === 'lost'}
          onClick={() => setActiveTab('lost')}
          label="My Lost Items"
          count={lostItems.length}
        />
        <TabButton
          active={activeTab === 'found'}
          onClick={() => setActiveTab('found')}
          label="My Found Items"
          count={foundItems.length}
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ReportCardSkeleton key={i} />
          ))}
        </div>
      ) : currentItems.length === 0 ? (
        <EmptyState type={activeTab} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map((item) => (
            <ReportCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary-600 text-primary-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label} <span className="ml-1 text-xs opacity-75">({count})</span>
    </button>
  );
}

function normalizeReports(reports: ReportResponse[], type: 'lost' | 'found'): DashboardItem[] {
  return reports.map((report) => ({
    id: report.id,
    category: report.category,
    brand: report.brand,
    colour: report.colour,
    description: report.description,
    location: report.location,
    photo_url: report.photo_url,
    status: report.status,
    created_at: report.created_at,
    event_time: report.event_time || report.lost_at || report.found_at || report.created_at,
    type,
  }));
}

function ReportCard({ item }: { item: DashboardItem }) {
  return (
    <Link
      href={`/matches/${item.id}?type=${item.type}`}
      className="card hover:shadow-md transition-shadow group flex flex-col"
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`badge ${statusColours[item.status] || 'bg-gray-100 text-gray-600'}`}>
          {item.status}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500" />
      </div>

      {item.photo_url ? (
        <div className="relative w-full h-40 mb-3">
          <Image
            src={item.photo_url}
            alt={item.category}
            fill
            className="object-cover rounded-lg"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      ) : (
        <div className="w-full h-40 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
          <PackageOpen className="w-10 h-10 text-gray-300" />
        </div>
      )}

      <h3 className="font-medium text-gray-900 capitalize">{item.category}</h3>
      <p className="text-sm text-gray-600 line-clamp-2 mt-1 flex-grow">{item.description}</p>

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

function ReportCardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-5 w-16 bg-gray-200 rounded-full" />
        <div className="h-4 w-4 bg-gray-200 rounded" />
      </div>
      <div className="w-full h-40 bg-gray-200 rounded-lg mb-3" />
      <div className="h-5 w-1/3 bg-gray-200 rounded mb-2" />
      <div className="h-4 w-full bg-gray-200 rounded mb-1" />
      <div className="h-4 w-2/3 bg-gray-200 rounded mb-3" />
      <div className="flex items-center gap-4 mt-auto">
        <div className="h-3 w-20 bg-gray-200 rounded" />
        <div className="h-3 w-20 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: Tab }) {
  const label = type === 'lost' ? 'lost' : 'found';
  const href = `/report/${type}`;

  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
        <PackageOpen className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">No {label} items yet</h3>
      <p className="text-gray-500 mt-1 mb-6 max-w-sm mx-auto">
        You haven’t reported any {label} items. Create a report and our AI will start looking for matches.
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 btn-primary"
      >
        <Plus className="w-4 h-4" />
        Report a {label.charAt(0).toUpperCase() + label.slice(1)} Item
      </Link>
    </div>
  );
}
