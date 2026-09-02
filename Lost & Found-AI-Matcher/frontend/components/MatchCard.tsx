'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Match } from '@/types';
import { verifyApi } from '@/lib/api';
import { CheckCircle, XCircle, MessageCircle, Send, AlertTriangle, PackageCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface MatchCardProps {
  match: Match;
  userRole: 'claimant' | 'finder' | 'admin';
  onVerified?: () => void;
}

export function MatchCard({ match, userRole, onVerified }: MatchCardProps) {
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
    'text-gray-500';

  const handleStartVerification = async () => {
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
        // Incorrect: keep the verification panel open with the new question.
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
        // Finder marked incorrect: a new question is generated for the claimant.
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

  const otherItem = userRole === 'claimant'
    ? { category: match.found_category, description: match.found_description, location: match.found_location, photo: match.found_photo_url }
    : { category: match.lost_category, description: match.lost_description, location: match.lost_location, photo: match.lost_photo_url };

  const isDisputed = match.status === 'disputed';
  const isReturned = match.lost_status === 'returned' || match.found_status === 'returned';

  return (
    <div className="card">
      {/* Score badge */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {otherItem.photo && (
            <img src={otherItem.photo} alt="Item" className="w-16 h-16 rounded-lg object-cover border" />
          )}
          <div>
            <p className="font-medium text-gray-900 capitalize">{otherItem.category || 'Unknown item'}</p>
            <p className="text-sm text-gray-500">{otherItem.location}</p>
          </div>
        </div>
        <span className={`text-2xl font-bold ${scoreColour}`}>
          {match.total_score}%
        </span>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs text-gray-500 mb-4">
        <div><span className="block font-semibold text-gray-700">{match.desc_score}%</span>Description</div>
        <div><span className="block font-semibold text-gray-700">{match.image_score ?? '-'}%</span>Image</div>
        <div><span className="block font-semibold text-gray-700">{match.location_score}%</span>Location</div>
        <div><span className="block font-semibold text-gray-700">{match.time_score}%</span>Time</div>
        <div><span className="block font-semibold text-gray-700">{match.attr_score}%</span>Attributes</div>
      </div>

      {/* Description preview */}
      {otherItem.description && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4 line-clamp-3">
          {otherItem.description}
        </p>
      )}

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
    </div>
  );
}
