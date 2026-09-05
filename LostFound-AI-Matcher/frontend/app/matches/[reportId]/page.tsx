'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { matchesApi } from '@/lib/api';
import { MatchCard } from '@/components/MatchCard';
import type { Match } from '@/types';
import { Loader2, ArrowLeft, PackageOpen } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MatchesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params.reportId as string;
  const type = (searchParams.get('type') || 'lost') as 'lost' | 'found';

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await matchesApi.getByReport(reportId, type) as Match[];
      const sorted = [...data].sort((a, b) => b.total_score - a.total_score);
      setMatches(sorted);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load matches';
      toast.error(message);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [reportId, type]);

  useEffect(() => {
    if (reportId) fetchMatches();
  }, [reportId, type, fetchMatches]);

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => b.total_score - a.total_score),
    [matches]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>

      <h1 className="text-3xl font-bold mb-2">Match Results</h1>
      <p className="text-gray-600 mb-8">
        {sortedMatches.length === 0
          ? 'No matches found yet. Check back later.'
          : `Found ${sortedMatches.length} potential match(es), sorted by best score.`}
      </p>

      {sortedMatches.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <PackageOpen className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No matches yet</h3>
          <p className="text-gray-500 mt-1 max-w-sm mx-auto">
            We’ll notify you as soon as a potential match is found for this report.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              userRole={type === 'lost' ? 'claimant' : 'finder'}
              onVerified={fetchMatches}
            />
          ))}
        </div>
      )}
    </div>
  );
}
