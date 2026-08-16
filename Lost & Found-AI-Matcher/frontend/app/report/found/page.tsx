'use client';

import { useRouter } from 'next/navigation';
import { ReportForm } from '@/components/ReportForm';
import { reportsApi, matchesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

export default function ReportFoundPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!user) {
      toast.error('Please log in first');
      router.push('/login');
      return;
    }

    const result = await reportsApi.createFound(data) as { id: string };
    toast.success('Found item reported! Running match engine...');

    try {
      const { match_count } = await matchesApi.run(result.id, 'found');
      if (match_count > 0) {
        toast.success(`Found ${match_count} potential match(es)!`);
        router.push(`/matches/${result.id}?type=found`);
      } else {
        toast('Report saved. We will notify you when someone claims this item.', { icon: '🔔' });
        router.push('/dashboard');
      }
    } catch {
      toast('Report saved. Matching will run later.');
      router.push('/dashboard');
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-center mb-2">Report a Found Item</h1>
      <p className="text-center text-gray-600 mb-10">
        Help someone get their item back. Add a private detail for verification.
      </p>
      <ReportForm type="found" onSubmit={handleSubmit} />
    </div>
  );
}
