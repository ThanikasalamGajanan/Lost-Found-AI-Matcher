'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ReportForm } from '@/components/ReportForm';
import { SimilarItems } from '@/components/SimilarItems';
import { reportsApi, matchesApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface SimilarItem {
  id: string;
  category: string;
  brand: string | null;
  colour: string | null;
  description: string;
  location: string;
  photo_url: string | null;
  similarity_score: number;
}

export default function ReportLostPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
  const [fullMatchCount, setFullMatchCount] = useState<number | null>(null);

  const handleSubmit = async (data: Record<string, unknown>) => {
    if (!user) {
      toast.error('Please log in first');
      router.push('/login');
      return;
    }

    const result = await reportsApi.createLost(data) as {
      id: string;
      similar_found_items?: SimilarItem[];
    };

    setReportId(result.id);
    setSimilarItems(result.similar_found_items || []);
    setSubmitted(true);

    if ((result.similar_found_items || []).length > 0) {
      toast.success(`Found ${result.similar_found_items!.length} similar found item(s)!`);
    } else {
      toast.success('Lost item reported!');
    }

    // Trigger the full matching engine in the background (non-blocking)
    matchesApi.run(result.id, 'lost')
      .then(({ match_count }) => {
        setFullMatchCount(match_count);
        if (match_count > (result.similar_found_items?.length || 0)) {
          toast.success(`Full scan found ${match_count} match(es) — check your matches page.`);
        }
      })
      .catch(() => {
        // Full matching may fail (e.g. no candidates) — non-fatal
      });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-center mb-2">Report a Lost Item</h1>
      <p className="text-center text-gray-600 mb-10">
        Fill in the details below and our AI will search for matches.
      </p>

      {!submitted ? (
        <ReportForm type="lost" onSubmit={handleSubmit} />
      ) : (
        <div className="max-w-2xl mx-auto">
          {/* Instant embedding results */}
          <SimilarItems items={similarItems} label="found" />

          {similarItems.length === 0 && (
            <p className="text-center text-gray-500 mt-8">
              No similar found items yet — we&apos;ll notify you as soon as a match appears.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center mt-8">
            {reportId && fullMatchCount !== null && fullMatchCount > 0 && (
              <button
                className="btn-primary"
                onClick={() => router.push(`/matches/${reportId}?type=lost`)}
              >
                View All {fullMatchCount} Match(es)
              </button>
            )}
            <button
              className="btn-secondary"
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setSubmitted(false);
                setSimilarItems([]);
                setFullMatchCount(null);
              }}
            >
              Report Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
