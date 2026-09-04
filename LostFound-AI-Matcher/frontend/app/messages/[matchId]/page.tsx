'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { messagesApi } from '@/lib/api';
import type { Message } from '@/types';
import { Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MessageThreadPage() {
  const params = useParams();
  const matchId = (params.matchId as string) || '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!matchId) return;
    try {
      const data = await messagesApi.getThread(matchId);
      setMessages(data.messages);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load messages';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [matchId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await messagesApi.send(matchId, body.trim());
      setBody('');
      await fetchMessages();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Message Thread</h1>

      <div className="card mb-4 h-[60vh] overflow-y-auto flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-center py-10">No messages yet. Start the conversation below.</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm text-gray-900">{msg.sender_name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(msg.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-800 whitespace-pre-wrap">{msg.body}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          className="input-field"
          placeholder="Type a message..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={sending}
        />
        <button
          onClick={handleSend}
          className="btn-primary flex items-center gap-2"
          disabled={sending || !body.trim()}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </button>
      </div>
    </div>
  );
}
