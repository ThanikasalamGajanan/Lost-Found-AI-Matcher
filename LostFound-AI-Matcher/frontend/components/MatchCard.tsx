'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Match } from '@/types';
import { verifyApi } from '@/lib/api';
import { CheckCircle, XCircle, MessageCircle, Send, AlertTriangle, PackageCheck, X } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface MatchCardProps {
  match: Match;
  userRole: 'claimant' | 'finder' | 'admin';
  onClaim?: () => void;
  onVerified?: () => void;
}

export function MatchCard({ match, userRole, onClaim, onVerified }: MatchCardProps) {
  const [showVerification, setShowVerification] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(match.status === 'approved');
  const [pendingAttemptId, setPendingAttemptId] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [retriesRemaining, setRetriesRemaining] = useState<number | null>(null);

  const scoreColour =
    match.total_score >= 80 ? 'text-green-600' :
    match.total_score >= 60 ? 'text-yellow-600' :
    'text-red-600';

  const scoreBgColour =
    match.total_score >= 80 ? 'bg-green-500' :
    match.total_score >= 60 ? 'bg-yellow-500' :
    'bg-red-500';

  const otherItem = userRole === 'claimant'
    ? {
        category: match.found_category,
        brand: match.found_brand,
        colour: match.found_colour,
        description: match.found_description,
        location: match.found_location,
        photo: match.found_photo_url,
      }
    : {
        category: match.lost_category,
        brand: match.lost_brand,
        colour: match.lost_colour,
        description: match.lost_description,
        location: match.lost_location,
        photo: match.lost_photo_url,
      };

  const handleStartVerification = async () => {
    onClaim?.();
    try {
      const result = await verifyApi.getQuestion(match.id);
      setQuestion(result.question_text);
      setShowVerification(true);
      setResultMessage('');
      setRetriesRemaining(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load question';
      toast.error(message);
    }
  };

  const handleSubmitAnswer = async () => {
    setSubmitting(true);
    setResultMessage('');
    try {
      const result = await verifyApi.submitAnswer(match.id, answer);

      if (result.result === 'correct') {
        setVerified(true);
        setShowVerification(false);
        setPendingAttemptId('');
        toast.success(result.message);
        onVerified?.();
      } else if (result.result === 'escalated') {
        setShowVerification(false);
        setPendingAttemptId('');
        toast.error(result.message);
      } else {
        setPendingAttemptId(result.attempt_id);
        if (result.new_question) {
          setQuestion(result.new_question.question_text);
        }
        setRetriesRemaining(result.retries_remaining ?? null);
        setResultMessage(result.message);
        setAnswer('');
        toast.error(result.message);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJudge = async (isCorrect: boolean) => {
    if (!pendingAttemptId) {
      toast.error('No pending answer to judge');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyApi.judgeAnswer(match.id, isCorrect, pendingAttemptId);
      toast.success(result.message);

      if (result.result === 'correct') {
        setVerified(true);
        setPendingAttemptId('');
        setShowVerification(false);
        onVerified?.();
      } else if (result.result === 'escalated') {
        setPendingAttemptId('');
        setShowVerification(false);
      } else {
        setPendingAttemptId('');
        if (result.new_question) {
          setQuestion(result.new_question.question_text);
        }
        setRetriesRemaining(result.retries_remaining ?? null);
        setResultMessage(result.message);
        setShowVerification(false);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to judge';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const isDisputed = match.status === 'disputed';
  const isReturned = match.lost_status === 'returned' || match.found_status === 'returned';

  return (
    <div className="card">
      {/* Header: thumbnail + chips + score */}
      <div className="flex items-start gap-4 mb-5">
        {otherItem.photo ? (
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl border flex-shrink-0 overflow-hidden">
            <Image
              src={otherItem.photo}
              alt={otherItem.category || 'Item'}
              fill
              className="object-cover"
              sizes="96px"
            />
          </div>
        ) : (
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">📦</span>
          </div>
        )}

        <div className="flex-grow min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            {otherItem.category && (
              <span className="badge badge-info capitalize">{otherItem.category}</span>
            )}
            {otherItem.colour && (
              <span className="badge badge-warning capitalize">{otherItem.colour}</span>
            )}
            {otherItem.brand && (
              <span className="badge bg-gray-100 text-gray-700">{otherItem.brand}</span>
            )}
          </div>

          <p className="text-sm text-gray-600 line-clamp-2">{otherItem.description}</p>

          <div className="mt-2 text-xs text-gray-500 space-y-0.5">
            {otherItem.location && <p>📍 {otherItem.location}</p>}
            <p>🕒 {formatTime(match.created_at)}</p>
          </div>
        </div>

        <div className="flex flex-col items-center flex-shrink-0">
          <span className={`text-2xl font-bold ${scoreColour}`}>{match.total_score}%</span>
          <span className="text-xs text-gray-500">match</span>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs text-gray-500 mb-4">
        <div><span className="block font-semibold text-gray-700">{match.desc_score}%</span>Description</div>
        <div><span className="block font-semibold text-gray-700">{match.image_score ?? '-'}%</span>Image</div>
        <div><span className="block font-semibold text-gray-700">{match.location_score}%</span>Location</div>
        <div><span className="block font-semibold text-gray-700">{match.time_score}%</span>Time</div>
        <div><span className="block font-semibold text-gray-700">{match.attr_score}%</span>Attributes</div>
      </div>

      {/* Score breakdown bars */}
      <div className="space-y-3 mb-5">
        <ScoreBar label="Description" value={match.desc_score} colour={scoreBgColour} />
        <ScoreBar label="Image" value={match.image_score} colour={scoreBgColour} />
        <ScoreBar label="Location" value={match.location_score} colour={scoreBgColour} />
        <ScoreBar label="Time" value={match.time_score} colour={scoreBgColour} />
        <ScoreBar label="Attributes" value={match.attr_score} colour={scoreBgColour} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {isReturned ? (
          <div className="flex items-center gap-2 text-emerald-700 font-medium">
            <PackageCheck className="w-5 h-5" />
            Item returned — match closed
          </div>
        ) : isDisputed ? (
          <div className="flex items-center gap-2 text-amber-700 font-medium">
            <AlertTriangle className="w-5 h-5" />
            Escalated to admin — awaiting review
          </div>
        ) : verified ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-green-600 font-medium">
              <CheckCircle className="w-5 h-5" />
              Verified — contact info unlocked
            </div>
            <Link
              href={`/messages/${match.id}`}
              className="btn-secondary text-sm inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Open Message Thread
            </Link>
          </div>
        ) : userRole === 'claimant' ? (
          !showVerification ? (
            <button onClick={handleStartVerification} className="btn-primary text-sm flex items-center gap-2 self-start">
              <MessageCircle className="w-4 h-4" /> Start Verification
            </button>
          ) : (
            <div className="w-full space-y-3">
              <p className="text-sm font-medium text-blue-800 bg-blue-50 rounded-lg p-3">
                Q: {question}
              </p>
              <input
                type="text"
                className="input-field"
                placeholder="Your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
              />
              <button onClick={handleSubmitAnswer} className="btn-primary text-sm" disabled={submitting || !answer}>
                {submitting ? 'Submitting...' : 'Submit Answer'}
              </button>
              {resultMessage && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  {resultMessage}
                  {retriesRemaining !== null && (
                    <span className="block text-xs mt-1">{retriesRemaining} retry attempt(s) remaining.</span>
                  )}
                </p>
              )}
            </div>
          )
        ) : userRole === 'finder' ? (
          pendingAttemptId ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                A verification answer is pending your review. Override the system verdict if needed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleJudge(true)}
                  className="btn-primary text-sm flex items-center gap-1 bg-green-600 hover:bg-green-700"
                  disabled={submitting}
                >
                  <CheckCircle className="w-4 h-4" /> Correct
                </button>
                <button
                  onClick={() => handleJudge(false)}
                  className="btn-danger text-sm flex items-center gap-1"
                  disabled={submitting}
                >
                  <XCircle className="w-4 h-4" /> Incorrect
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Waiting for the claimant to answer the verification question.</p>
          )
        ) : null}
      </div>

      {/* Verification modal */}
      {showVerification && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Verify this is yours</h3>
              <button
                onClick={() => setShowVerification(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              The finder has set a private question. Answer correctly to prove ownership.
            </p>
            <div className="text-sm font-medium text-blue-800 bg-blue-50 rounded-lg p-3 mb-4">
              Q: {question}
            </div>
            <input
              type="text"
              className="input-field mb-4"
              placeholder="Your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowVerification(false)}
                className="btn-secondary flex-1 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAnswer}
                className="btn-primary flex-1 text-sm"
                disabled={submitting || !answer.trim()}
              >
                {submitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-900">{value}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${colour} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function formatTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}