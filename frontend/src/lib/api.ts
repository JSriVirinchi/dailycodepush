import type {
  POTD,
  ReferencesResponse,
  SubmissionHistoryResponse,
  SubmitSolutionPayload,
  SubmitSolutionResponse
} from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {})
      }
    });
  } catch (error) {
    throw new Error(`Network error while requesting ${url}: ${(error as Error).message}`);
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    throw new ApiError(`Request to ${url} failed with status ${response.status}`, response.status, payload);
  }

  return payload as T;
}

export async function getPOTD(): Promise<POTD> {
  return request<POTD>('/api/potd');
}

export async function getReferences(slug: string, language?: string): Promise<ReferencesResponse> {
  const params = new URLSearchParams({ slug });
  if (language) {
    params.set('lang', language);
  }
  return request<ReferencesResponse>(`/api/references?${params.toString()}`);
}

type SessionStatusResponse = {
  connected: boolean;
  leetcode_session: string | null;
  csrf_token: string | null;
};

export async function getLeetCodeSessionStatus(): Promise<SessionStatusResponse> {
  return request<SessionStatusResponse>('/api/leetcode/session');
}

export async function storeLeetCodeSession(leetcodeSession: string, csrfToken: string): Promise<void> {
  await request('/api/leetcode/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      leetcode_session: leetcodeSession,
      csrf_token: csrfToken
    })
  });
}

export async function clearLeetCodeSession(): Promise<void> {
  await request('/api/leetcode/session', {
    method: 'DELETE'
  });
}

export async function submitSolution(payload: SubmitSolutionPayload): Promise<SubmitSolutionResponse> {
  return request<SubmitSolutionResponse>('/api/leetcode/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

export async function getRecentSubmissions(slug: string, limit = 20): Promise<SubmissionHistoryResponse> {
  const params = new URLSearchParams({ slug });
  params.set('limit', Math.max(1, Math.min(50, limit)).toString());
  return request<SubmissionHistoryResponse>(`/api/leetcode/submissions?${params.toString()}`);
}

export { API_BASE_URL, ApiError };
