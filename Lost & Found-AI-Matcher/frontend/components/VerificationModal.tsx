'use client';

import { useEffect, useState } from 'react';
import { verifyApi } from '@/lib/api';
import { X, Shield, Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface VerificationModalProps {
  matchId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

type ModalState =
  | { kind: 'loading' }
  | { kind: 'ready'; question: string }
  | { kind: 'submitting' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function VerificationModal({ matchId, isOpen, onClose, onSubmitted }: VerificationModalProps) {
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<ModalState>({ kind: 'loading' });

  useEffect(() => {
    if (!isOpen) {
      setAnswer('');
      setState({ kind: 'loading' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'loading' });

    verifyApi
      .getQuestion(matchId)
      .then((result) => {
        if (!cancelled) setState({ kind: 'ready', question: result.question_text });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load verification question';
          setState({ kind: 'error', message });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, matchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;

    setState({ kind: 'submitting' });

    try {
      const result = await verifyApi.submitAnswer(matchId, answer.trim());
      setState({ kind: 'success', message: result.message || 'Answer submitted successfully.' });
      onSubmitted();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      setState({ kind: 'error', message });
      toast.error(message);
    }
  };

  const handleClose = () => {
    setAnswer('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-bold text-gray-900">Verify Ownership</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {state.kind === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-3" />
              <p className="text-sm text-gray-600">Loading verification question...</p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="flex flex-col items-center text-center py-6">
              <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm text-gray-700 mb-4">{state.message}</p>
              <button onClick={handleClose} className="btn-secondary text-sm">
                Close
              </button>
            </div>
          )}

          {state.kind === 'success' && (
            <div className="flex flex-col items-center text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-green-500 mb-3" />
              <p className="text-sm text-gray-700 mb-4">{state.message}</p>
              <button onClick={handleClose} className="btn-primary text-sm">
                Done
              </button>
            </div>
          )}

          {(state.kind === 'ready' || state.kind === 'submitting') && (
            <form onSubmit={handleSubmit}>
              <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4 mb-5">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  To protect the owner’s privacy, the finder has set a question only the real owner can answer. Your answer will be reviewed before any contact details are shared.
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Question
              </label>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-5">
                <p className="text-gray-900 font-medium">
                  {state.kind === 'ready' ? state.question : '...'}
                </p>
              </div>

              <label htmlFor="verification-answer" className="block text-sm font-medium text-gray-700 mb-2">
                Your answer
              </label>
              <input
                id="verification-answer"
                type="text"
                className="input-field mb-5"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={state.kind === 'submitting'}
              />

              <button
                type="submit"
                className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={state.kind === 'submitting' || !answer.trim()}
              >
                {state.kind === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Submit Answer
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
