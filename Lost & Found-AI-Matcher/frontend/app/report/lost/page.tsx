'use client';

import { useRouter } from 'next/navigation';
import { ReportForm } from '@/components/ReportForm';
import { reportsApi, matchesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function ReportLostPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!user) {
      toast.error('Please log in first');
      router.push('/login');
      return;
    }

    const result = await reportsApi.createLost(data) as { id: string };
    toast.success('Lost item reported! Running match engine...');

    // Automatically trigger matching
    try {
      const { match_count } = await matchesApi.run(result.id, 'lost');
      if (match_count > 0) {
        toast.success(`Found ${match_count} potential match(es)!`);
        router.push(`/matches/${result.id}?type=lost`);
      } else {
        toast('No matches yet — we will notify you when one appears.', { icon: '🔔' });
        router.push('/dashboard');
      }
    } catch {
      toast('Report saved. Matching will run later.');
      router.push('/dashboard');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-center mb-2">Report a Lost Item</h1>
      <p className="text-center text-gray-600 mb-10">
        Fill in the details below and our AI will search for matches.
      </p>
      <ReportForm type="lost" onSubmit={handleSubmit} />
    </div>
  );
}
