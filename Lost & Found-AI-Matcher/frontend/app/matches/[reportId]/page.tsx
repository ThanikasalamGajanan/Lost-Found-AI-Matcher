'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { matchesApi } from '@/lib/api';
import { MatchCard } from '@/components/MatchCard';
import type { Match } from '@/types';
import { Loader2 } from 'lucide-react';

export default function MatchesPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = params.reportId as string;
  const type = (searchParams.get('type') || 'lost') as 'lost' | 'found';

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const data = await matchesApi.getByReport(reportId, type) as Match[];
      setMatches(data);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportId) fetchMatches();
  }, [reportId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Match Results</h1>
      <p className="text-gray-600 mb-8">
        {matches.length === 0
          ? 'No matches found yet. Check back later.'
          : `Found ${matches.length} potential match(es), sorted by score.`}
      </p>

      <div className="space-y-4">
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            userRole={type === 'lost' ? 'claimant' : 'finder'}
            onVerified={fetchMatches}
          />
        ))}
      </div>
    </div>
  );
}
