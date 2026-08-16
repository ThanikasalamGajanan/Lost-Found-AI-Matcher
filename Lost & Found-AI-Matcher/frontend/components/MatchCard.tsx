'use client';

import { useState } from 'react';
import type { Match } from '@/types';
import { verifyApi } from '@/lib/api';
import { CheckCircle, XCircle, MessageCircle } from 'lucide-react';
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

  const scoreColour =
    match.total_score >= 80 ? 'text-green-600' :
    match.total_score >= 60 ? 'text-yellow-600' :
    'text-gray-500';

  const handleStartVerification = async () => {
    try {
      const result = await verifyApi.getQuestion(match.id);
      setQuestion(result.question_text);
      setShowVerification(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load question';
      toast.error(message);
    }
  };

  const handleSubmitAnswer = async () => {
    setSubmitting(true);
    try {
      await verifyApi.submitAnswer(match.id, answer);
      toast.success('Answer submitted! Waiting for the finder to verify.');
      setShowVerification(false);
      setAnswer('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleJudge = async (isCorrect: boolean) => {
    setSubmitting(true);
    try {
      const result = await verifyApi.judgeAnswer(match.id, isCorrect, '') as { result: string; message: string };
      toast.success(result.message);
      if (isCorrect) {
        setVerified(true);
        onVerified?.();
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
        <div><span className="block font-semibold text-gray-700">{match.image_score}%</span>Image</div>
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
      <div className="flex gap-3">
        {verified ? (
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle className="w-5 h-5" />
            Verified — contact info unlocked
          </div>
        ) : userRole === 'claimant' ? (
          !showVerification ? (
            <button onClick={handleStartVerification} className="btn-primary text-sm flex items-center gap-2">
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
            </div>
          )
        ) : userRole === 'finder' ? (
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
        ) : null}
      </div>
    </div>
  );
}
