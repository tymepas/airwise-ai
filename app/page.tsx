'use client';

import { useState, useMemo } from 'react';

interface ChatResponse {
  success: boolean;
  decision: string;
  reason: string;
  actions: string[];
  sources: string[];
}

type DecisionTone = 'green' | 'red' | 'yellow' | 'blue';

const TECH_BADGES = ['Gemini AI', 'Elasticsearch', 'RAG', 'Next.js', 'Tailwind'];

const PLACEHOLDER_TEXT =
  'Can my child play outside today?\nShould I wear an N95 today?\nIs it safe to go jogging?';

function getDecisionTone(decision: string): DecisionTone {
  const lower = decision.toLowerCase();
  if (lower.includes('not recommended')) return 'red';
  if (lower.includes('recommended')) return 'green';
  if (lower.includes('caution')) return 'yellow';
  return 'blue';
}

const TONE_STYLES: Record<
  DecisionTone,
  {
    bg: string;
    ring: string;
    badge: string;
    icon: string;
  }
> = {
  green: {
    bg: 'from-emerald-500 to-emerald-600',
    ring: 'shadow-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: 'text-emerald-100',
  },
  red: {
    bg: 'from-rose-500 to-red-600',
    ring: 'shadow-rose-200',
    badge: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-100',
  },
  yellow: {
    bg: 'from-amber-400 to-orange-500',
    ring: 'shadow-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: 'text-amber-100',
  },
  blue: {
    bg: 'from-blue-600 to-indigo-600',
    ring: 'shadow-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    icon: 'text-blue-100',
  },
};

export default function Home() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResponse | null>(null);

  const tone = useMemo(
    () => (result ? getDecisionTone(result.decision) : 'blue'),
    [result]
  );

  const handleAsk = async () => {
    if (!question.trim()) {
      setError('Please enter a question before asking AirWise AI.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: question }),
      });

      if (!res.ok) {
        throw new Error('Something went wrong while contacting AirWise AI.');
      }

      const data: ChatResponse = await res.json();

      if (!data.success) {
        throw new Error('AirWise AI could not process this request.');
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unexpected error occurred. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAsk();
    }
  };

  const toneStyle = TONE_STYLES[tone];

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 flex flex-col items-center px-4 sm:px-6 py-20 sm:py-28">
      <div className="w-full max-w-3xl flex flex-col items-center text-center gap-5">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 shadow-lg shadow-blue-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-9 h-9"
          >
            <path d="M9.59 4.59A2 2 0 1 1 11 8H2" />
            <path d="M17.59 20.59A2 2 0 1 0 19 17H2" />
            <path d="M12.59 11.59A2 2 0 1 1 14 15H2" />
          </svg>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-600 bg-clip-text text-transparent pb-1">
          AirWise AI
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 font-medium max-w-xl leading-relaxed">
          AI Powered Public Health Decision Agent
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {TECH_BADGES.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white/80 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold text-slate-600 shadow-sm"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <div className="w-full max-w-3xl mt-14 rounded-3xl bg-white/60 backdrop-blur-xl border border-white shadow-xl shadow-blue-100 p-6 sm:p-10">
        <label
          htmlFor="question"
          className="block text-sm font-semibold text-slate-700 mb-3"
        >
          Ask a health related question
        </label>

        <textarea
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDER_TEXT}
          rows={4}
          disabled={loading}
          className="w-full resize-none rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 text-base text-slate-800 placeholder:text-slate-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <button
            onClick={handleAsk}
            disabled={loading}
            className="flex-1 sm:flex-none sm:min-w-[200px] inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 px-8 py-4 text-white font-semibold text-base shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-emerald-200 hover:brightness-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-200 transition disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 disabled:hover:brightness-100"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-90"
                    fill="currentColor"
                    d="M4 12a8 8 0 0 1 8 8V12H4z"
                  />
                </svg>
                Analyzing
              </>
            ) : (
              <>Ask AI</>
            )}
          </button>

          <p className="text-xs text-slate-400 text-center sm:text-left">
            Press Cmd or Ctrl plus Enter to ask quickly
          </p>
        </div>

        {loading && (
          <p className="mt-4 text-sm text-blue-600 font-medium animate-pulse">
            Analyzing public health guidance...
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="w-full max-w-3xl mt-8 rounded-2xl border border-red-200 bg-red-50 px-6 py-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-red-100 text-red-500 shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-red-700">
                Something went wrong
              </p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="w-full max-w-3xl mt-10 flex flex-col gap-6">
          <div
            className={`rounded-3xl bg-gradient-to-br ${toneStyle.bg} text-white p-8 sm:p-10 shadow-xl ${toneStyle.ring}`}
          >
            <p className="text-xs uppercase tracking-widest text-white/80 font-semibold">
              Decision
            </p>
            <p className="text-3xl sm:text-4xl font-bold mt-3 leading-snug">
              {result.decision}
            </p>
          </div>

          <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white shadow-lg p-8 sm:p-10">
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
              Reason
            </p>
            <p className="text-lg text-slate-700 mt-4 leading-relaxed">
              {result.reason}
            </p>
          </div>

          {result.actions && result.actions.length > 0 && (
            <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white shadow-lg p-8 sm:p-10">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-5">
                Recommended Actions
              </p>
              <ul className="flex flex-col gap-4">
                {result.actions.map((action, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-slate-700"
                  >
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 shrink-0 mt-0.5">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-3.5 h-3.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                    <span className="leading-relaxed text-base">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.sources && result.sources.length > 0 && (
            <div className="rounded-3xl bg-white/70 backdrop-blur-xl border border-white shadow-lg p-8 sm:p-10">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-5">
                Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {result.sources.map((source, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-sm font-semibold px-5 py-2"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-6 py-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="text-xl leading-none">⚠️</span>
              <p className="text-sm text-amber-800 leading-relaxed">
                This tool supports health decisions but is not a substitute
                for professional medical advice.
              </p>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-16 text-xs text-slate-400 text-center">
        AirWise AI uses environmental and health data to support decisions and
        does not replace professional medical advice.
      </footer>
    </main>
  );
}