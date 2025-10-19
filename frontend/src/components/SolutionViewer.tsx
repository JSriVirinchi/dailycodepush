import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, getRecentSubmissions, submitSolution } from '../lib/api';
import type { CommunitySolution, SubmissionResult, SubmissionStep, SubmissionSummary } from '../lib/types';

type SolutionViewerProps = {
  solution: CommunitySolution | null;
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  selectedLanguage: string;
  questionSlug: string | null;
};

const decodeHtml = (snippet: string) =>
  snippet
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<br\s*\/?>/gi, '\n');

const normalizeEscapes = (value: string): string =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
    .replace(/\\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');

const extractCodeFromContent = (rawContent: string | null | undefined): string | null => {
  if (!rawContent) {
    return null;
  }

  const content = normalizeEscapes(rawContent);

  const fenceMatch = content.match(/```[^\n]*\n([\s\S]*?)```/);
  if (fenceMatch && fenceMatch[1].trim()) {
    return fenceMatch[1].trimEnd();
  }

  const htmlMatch = content.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
  if (htmlMatch && htmlMatch[1].trim()) {
    return decodeHtml(htmlMatch[1].trim()).trimEnd();
  }

  return null;
};

const STEP_STYLE: Record<SubmissionStep['status'], string> = {
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
  info: 'bg-slate-100 text-slate-600'
};

const STORAGE_KEY_PREFIX = 'leetcode-submission:';

const getStorageKey = (slug: string) => `${STORAGE_KEY_PREFIX}${slug}`;

const SolutionViewer = ({ solution, isLoading, errorMessage, onRetry, selectedLanguage, questionSlug }: SolutionViewerProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSteps, setSubmissionSteps] = useState<SubmissionStep[]>([]);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionSummary[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [hasMoreSubmissions, setHasMoreSubmissions] = useState(false);

  const formatStepLabel = useCallback(
    (value: string) =>
      value
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase()),
    []
  );
  const getStatusLabel = useCallback((status: SubmissionStep['status']) => {
    if (status === 'success') {
      return 'Success';
    }
    if (status === 'error') {
      return 'Error';
    }
    return 'Info';
  }, []);

  const getSubmissionStatusClass = useCallback((statusDisplay?: string | null, isPending?: boolean) => {
    if (isPending) {
      return 'bg-amber-100 text-amber-700';
    }
    if (!statusDisplay) {
      return 'bg-slate-100 text-slate-600';
    }
    const normalized = statusDisplay.toLowerCase();
    if (normalized.includes('accept')) {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (normalized.includes('wrong') || normalized.includes('error') || normalized.includes('time') || normalized.includes('fail')) {
      return 'bg-rose-100 text-rose-700';
    }
    if (normalized.includes('pending')) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-slate-100 text-slate-600';
  }, []);

  const displayCode = useMemo(() => {
    if (!solution) {
      return null;
    }
    if (solution.code && solution.code.trim()) {
      return solution.code.trimEnd();
    }
    const fallback = extractCodeFromContent(solution.content);
    return fallback;
  }, [solution]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!questionSlug) {
      setSubmissionSteps([]);
      setSubmissionResult(null);
      setSubmissionError(null);
      return;
    }

    const stored = window.localStorage.getItem(getStorageKey(questionSlug));
    if (!stored) {
      setSubmissionSteps([]);
      setSubmissionResult(null);
      setSubmissionError(null);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as {
        steps?: SubmissionStep[];
        result?: SubmissionResult | null;
        error?: string | null;
      };
      setSubmissionSteps(Array.isArray(parsed.steps) ? parsed.steps : []);
      setSubmissionResult(parsed.result ?? null);
      setSubmissionError(parsed.error ?? null);
    } catch {
      setSubmissionSteps([]);
      setSubmissionResult(null);
      setSubmissionError(null);
    }
  }, [questionSlug]);

  const loadRecentSubmissions = useCallback(async () => {
    if (!questionSlug) {
      setRecentSubmissions([]);
      setHasMoreSubmissions(false);
      setSubmissionsError(null);
      return;
    }
    setIsLoadingSubmissions(true);
    try {
      const response = await getRecentSubmissions(questionSlug, 10);
      setRecentSubmissions(response.submissions);
      setHasMoreSubmissions(response.has_next);
      setSubmissionsError(null);
    } catch (error) {
      if (error instanceof ApiError) {
        const detail =
          error.data && typeof error.data === 'object' && 'detail' in (error.data as Record<string, unknown>)
            ? String((error.data as Record<string, unknown>).detail)
            : null;
        setSubmissionsError(detail ?? `${error.message}. Status: ${error.status}`);
      } else if (error instanceof Error) {
        setSubmissionsError(error.message);
      } else {
        setSubmissionsError('Failed to load submission history.');
      }
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [questionSlug]);

  useEffect(() => {
    if (!questionSlug) {
      setRecentSubmissions([]);
      setHasMoreSubmissions(false);
      setSubmissionsError(null);
      return;
    }
    void loadRecentSubmissions();
  }, [questionSlug, loadRecentSubmissions]);

  const handleSubmit = useCallback(async () => {
    if (!questionSlug) {
      setSubmissionSteps([]);
      setSubmissionResult(null);
      setSubmissionError('Question slug is not available, cannot submit to LeetCode.');
      return;
    }
    if (!displayCode) {
      setSubmissionSteps([]);
      setSubmissionResult(null);
      setSubmissionError('No code snippet is available to submit.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);
    setSubmissionResult(null);
    setSubmissionSteps([{ step: 'start', status: 'info', detail: 'Starting submission workflow.' }]);

    try {
      const response = await submitSolution({
        slug: questionSlug,
        language: selectedLanguage,
        code: displayCode
      });

      if (response.steps && response.steps.length > 0) {
        setSubmissionSteps(response.steps);
      } else {
        setSubmissionSteps((previous) => (previous.length ? previous : []));
      }
      if (response.result) {
        setSubmissionResult(response.result);
      }

      if (!response.ok) {
        setSubmissionError(response.error ?? 'LeetCode submission failed.');
      } else if (response.error) {
        setSubmissionError(response.error);
      }
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : 'Failed to submit solution.');
    } finally {
      setIsSubmitting(false);
      void loadRecentSubmissions();
    }
  }, [questionSlug, displayCode, selectedLanguage, loadRecentSubmissions]);

  const isSubmitDisabled = !displayCode || !questionSlug || isSubmitting;


  useEffect(() => {
    if (typeof window === 'undefined' || !questionSlug) {
      return;
    }

    if (!submissionSteps.length && !submissionResult && !submissionError) {
      window.localStorage.removeItem(getStorageKey(questionSlug));
      return;
    }

    const snapshot = {
      steps: submissionSteps,
      result: submissionResult,
      error: submissionError
    };

    try {
      window.localStorage.setItem(getStorageKey(questionSlug), JSON.stringify(snapshot));
    } catch {
      // Ignore storage errors (e.g., quota exceeded)
    }
  }, [questionSlug, submissionSteps, submissionResult, submissionError]);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex animate-pulse flex-col gap-4">
          <div className="h-6 w-48 rounded-xl bg-slate-200" />
          <div className="h-10 rounded-xl bg-slate-200" />
          <div className="h-64 rounded-xl bg-slate-200" />
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
        <h2 className="text-lg font-semibold">Could not load the community solution</h2>
        <p className="mt-2 text-sm">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!solution) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Community Solution</h2>
        <p className="mt-2 text-sm text-slate-500">
          No community solution with most votes is available for <span className="font-semibold text-slate-700">{selectedLanguage}</span> yet.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Community Solution (Most Votes)</p>
            <h3 className="text-lg font-semibold text-slate-900">{solution.title}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {solution.language && <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">{solution.language}</span>}
              {typeof solution.votes === 'number' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">
                  <span aria-hidden="true">▲</span>
                  {solution.votes}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => window.open(solution.url, '_blank', 'noreferrer')}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Open on LeetCode
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isSubmitting ? 'Submitting...' : 'Submit to LeetCode'}
            </button>
          </div>
        </div>
        {displayCode ? (
          <div className="max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-slate-950/90 text-slate-50 shadow-inner">
            <pre className="whitespace-pre-wrap p-4 text-sm leading-6">
              <code>{displayCode}</code>
            </pre>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Could not extract a {selectedLanguage} code snippet from the most voted solution. View the full post on LeetCode for details.
          </div>
        )}
        {(submissionSteps.length > 0 || submissionResult || submissionError || isSubmitting) && (
          <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Submission status</p>
              {isSubmitting && (
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-500" aria-hidden="true" />
                  In progress…
                </span>
              )}
            </div>
            {submissionSteps.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {submissionSteps.map((step, index) => (
                  <li key={`${step.step}-${index}`} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow-sm sm:flex-row sm:items-start sm:gap-3">
                    <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STEP_STYLE[step.status]}`}>
                      {getStatusLabel(step.status)}
                    </span>
                    <div className="text-xs text-slate-600 sm:text-sm">
                      <p className="font-medium text-slate-800">{formatStepLabel(step.step)}</p>
                      {step.detail && <p className="text-xs text-slate-500 sm:text-sm">{step.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-600">
                {isSubmitting ? 'Waiting for LeetCode to respond…' : 'No submission activity yet.'}
              </p>
            )}
            {submissionResult && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-inner">
                <p className="text-sm font-semibold text-slate-900">
                  Result: {submissionResult.status_msg ?? 'Unknown'}
                  {submissionResult.state ? ` (${submissionResult.state})` : ''}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {submissionResult.lang && (
                    <div>
                      <span className="font-medium text-slate-700">Language:</span> {submissionResult.lang}
                    </div>
                  )}
                  {submissionResult.runtime && (
                    <div>
                      <span className="font-medium text-slate-700">Runtime:</span> {submissionResult.runtime}
                    </div>
                  )}
                  {submissionResult.memory && (
                    <div>
                      <span className="font-medium text-slate-700">Memory:</span> {submissionResult.memory}
                    </div>
                  )}
                  {submissionResult.total_correct !== null && submissionResult.total_testcases !== null && (
                    <div>
                      <span className="font-medium text-slate-700">Tests:</span> {submissionResult.total_correct}/{submissionResult.total_testcases}
                    </div>
                  )}
                  {submissionResult.last_testcase && (
                    <div className="sm:col-span-2">
                      <span className="font-medium text-slate-700">Last testcase:</span> {submissionResult.last_testcase}
                    </div>
                  )}
                </div>
                {(submissionResult.expected_output || submissionResult.code_output) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {submissionResult.expected_output && (
                      <div>
                        <p className="font-medium text-slate-700">Expected output</p>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700 shadow-inner">
                          {submissionResult.expected_output}
                        </pre>
                      </div>
                    )}
                    {submissionResult.code_output && (
                      <div>
                        <p className="font-medium text-slate-700">Your output</p>
                        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] text-slate-700 shadow-inner">
                          {submissionResult.code_output}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                {submissionResult.runtime_error && (
                  <div className="mt-3">
                    <p className="font-medium text-rose-700">Runtime error</p>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-rose-50 p-2 text-[11px] text-rose-800 shadow-inner">
                      {submissionResult.runtime_error}
                    </pre>
                  </div>
                )}
                {submissionResult.compile_error && (
                  <div className="mt-3">
                    <p className="font-medium text-rose-700">Compile error</p>
                    <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-rose-50 p-2 text-[11px] text-rose-800 shadow-inner">
                      {submissionResult.compile_error}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {submissionError && (
              <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700">
                {submissionError}
              </p>
            )}
          </div>
        )}
        {questionSlug && (
          <div className="rounded-2xl border border-slate-200 bg-slate-100/70 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Recent LeetCode submissions</p>
              <button
                type="button"
                onClick={() => void loadRecentSubmissions()}
                disabled={isLoadingSubmissions || !questionSlug}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingSubmissions ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            {submissionsError ? (
              <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700">{submissionsError}</p>
            ) : isLoadingSubmissions ? (
              <div className="mt-3 space-y-2">
                <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
                <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
              </div>
            ) : recentSubmissions.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {recentSubmissions.map((submission) => (
                  <li key={submission.submission_id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getSubmissionStatusClass(submission.status_display, submission.is_pending)}`}>
                        {submission.status_display ?? 'Pending'}
                      </span>
                      {submission.relative_time && <span className="text-[11px] text-slate-500">{submission.relative_time}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      {submission.lang_name && <span className="rounded-full bg-slate-100 px-2 py-1 font-medium text-slate-600">{submission.lang_name}</span>}
                      {submission.runtime_display && <span className="rounded-full bg-slate-100 px-2 py-1">{submission.runtime_display}</span>}
                      {submission.memory_display && <span className="rounded-full bg-slate-100 px-2 py-1">{submission.memory_display}</span>}
                    </div>
                    {submission.url && (
                      <button
                        type="button"
                        onClick={() => submission.url && window.open(submission.url, '_blank', 'noreferrer')}
                        className="mt-3 inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
                      >
                        View on LeetCode
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-slate-600">No submissions found for this question.</p>
            )}
            {hasMoreSubmissions && !isLoadingSubmissions && !submissionsError && recentSubmissions.length > 0 && (
              <p className="mt-3 text-[11px] text-slate-500">Showing the 10 most recent submissions.</p>
            )}
          </div>
        )}
        {solution.content && (
          <details className="rounded-2xl border border-slate-200 bg-slate-100/60 p-4 text-sm text-slate-700">
            <summary className="cursor-pointer font-medium text-slate-800">View raw community content (debug)</summary>
            <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-white p-3 font-mono text-xs text-slate-800 shadow-inner">
              {solution.content}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
};

export default SolutionViewer;
