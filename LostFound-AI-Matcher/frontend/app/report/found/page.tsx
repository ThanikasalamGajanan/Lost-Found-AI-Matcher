'use client';

import { useRouter } from 'next/navigation';
import { ReportForm } from '@/components/ReportForm';
import { reportsApi, matchesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

function getUserIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const decoded = JSON.parse(json) as { sub?: string };
    return decoded.sub || null;
  } catch {
    return null;
  }
}

export default function ReportFoundPage() {
  const router = useRouter();
  const { user, token, logout } = useAuthStore();

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!user) {
      toast.error('Please log in first');
      router.push('/login');
      return;
    }

    const tokenUserId = getUserIdFromToken(token);
    if (token && tokenUserId && tokenUserId !== user.id) {
      toast.error('Session mismatch. Please log in again.');
      logout();
      router.push('/login');
      return;
    }

    const submitToast = toast.loading('Submitting found item report...');

    try {
      const result = await reportsApi.createFound(data);

      toast.dismiss(submitToast);
      const matchToast = toast.loading('Searching for matching lost items...');

      const { match_count } = await matchesApi.run(result.id, 'found');

      toast.dismiss(matchToast);

      if (match_count > 0) {
        toast.success(`Found ${match_count} potential match(es)!`);
        router.push(`/matches/${result.id}?type=found`);
      } else {
        toast('No matches found yet. We’ll notify you when someone reports a similar item.', {
          icon: '🔍',
        });
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      toast.dismiss(submitToast);
      const message = err instanceof Error ? err.message : 'Failed to report found item';
      toast.error(message);
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
