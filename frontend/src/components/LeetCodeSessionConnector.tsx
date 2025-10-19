import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearLeetCodeSession, getLeetCodeSessionStatus, storeLeetCodeSession } from '../lib/api';

const REQUEST_TYPE = 'LEETCODE_FETCH_COOKIES_REQUEST';
const RESPONSE_TYPE = 'LEETCODE_FETCH_COOKIES_RESPONSE';

type ConnectorStatus = 'idle' | 'fetching' | 'success' | 'error' | 'disconnected';

type ExtensionPayload =
  | {
      ok: true;
      leetcodeSession: string | null;
      csrfToken: string | null;
    }
  | {
      ok: false;
      error?: string;
      leetcodeSession?: string | null;
      csrfToken?: string | null;
    };

const LeetCodeSessionConnector = () => {
  const [status, setStatus] = useState<ConnectorStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [tokens, setTokens] = useState<{ leetcodeSession: string | null; csrfToken: string | null }>({
    leetcodeSession: null,
    csrfToken: null
  });

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getLeetCodeSessionStatus();
      setConnected(Boolean(data.connected));
      setStatus(data.connected ? 'success' : 'disconnected');
      setTokens({
        leetcodeSession: data.leetcode_session,
        csrfToken: data.csrf_token
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load session status.');
      setStatus('error');
      setTokens({ leetcodeSession: null, csrfToken: null });
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const handler = async (event: MessageEvent) => {
      if (event.source !== window || !event.data || event.data.type !== RESPONSE_TYPE) {
        return;
      }

      const payload: ExtensionPayload = event.data.payload;
      if (!payload.ok) {
        setStatus('error');
        setMessage(payload.error ?? 'Extension could not fetch cookies. Make sure you are logged in on leetcode.com.');
        return;
      }

      if (!payload.leetcodeSession || !payload.csrfToken) {
        setStatus('error');
        setMessage('Extension did not return both LEETCODE_SESSION and csrftoken cookies.');
        return;
      }

      try {
        await storeLeetCodeSession(payload.leetcodeSession, payload.csrfToken);
        setMessage('LeetCode session connected successfully.');
        await refreshStatus();
        setStatus('success');
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Failed to store session.');
      }
    };

    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);

  const handleFetch = () => {
    setStatus('fetching');
    setMessage('Requesting cookies from extension…');
    window.postMessage({ type: REQUEST_TYPE }, '*');
  };

  const handleDisconnect = async () => {
    try {
      await clearLeetCodeSession();
      await refreshStatus();
      setStatus('disconnected');
      setMessage('LeetCode session removed.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Failed to remove session.');
    }
  };

  const statusText = useMemo(() => {
    switch (status) {
      case 'success':
        return 'Connected';
      case 'fetching':
        return 'Waiting for extension…';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Not connected';
      default:
        return connected ? 'Connected' : 'Not connected';
    }
  }, [status, connected]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">LeetCode Session</p>
            <p className="text-xs text-slate-500">
              Use the development extension to pull your current LeetCode cookies and enable authenticated requests.
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              connected ? 'bg-emerald-100 text-emerald-700' : status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {statusText}
          </span>
        </div>
        {message && <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">{message}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleFetch}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={status === 'fetching'}
          >
            {status === 'fetching' ? 'Waiting…' : 'Fetch from extension'}
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!connected && status !== 'success'}
          >
            Disconnect
          </button>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-700">Debug tips</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>Ensure you are logged into leetcode.com in the same browser profile.</li>
            <li>Load the “LeetCode Session Bridge” extension in developer mode.</li>
            <li>Open the browser console to see extension errors if the request keeps failing.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">Current tokens</p>
          <dl className="mt-2 space-y-2">
            <div>
              <dt className="font-medium text-slate-600">LEETCODE_SESSION</dt>
              <dd className="break-all rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-slate-800 shadow-inner">
                {tokens.leetcodeSession || '—'}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-slate-600">csrftoken</dt>
              <dd className="break-all rounded-lg bg-white px-3 py-2 font-mono text-[11px] text-slate-800 shadow-inner">
                {tokens.csrfToken || '—'}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
};

export default LeetCodeSessionConnector;
