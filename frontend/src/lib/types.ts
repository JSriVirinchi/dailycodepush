export type POTD = {
  date: string;
  link: string;
  title: string;
  slug: string;
  frontendId: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acRate: number;
  tags: { name: string; slug: string }[];
};

export type ReferenceItem = {
  title: string;
  url: string;
  votes: number | null;
  language: string | null;
  source: 'editorial' | 'solutions_index' | string;
};

export type CommunitySolution = {
  id: number;
  title: string;
  url: string;
  votes: number | null;
  language: string | null;
  code: string | null;
  content: string | null;
};

export type ReferencesResponse = {
  slug: string;
  language: string | null;
  items: ReferenceItem[];
  community_solution: CommunitySolution | null;
};

export type SubmissionStep = {
  step: string;
  status: 'info' | 'success' | 'error';
  detail?: string | null;
};

export type SubmissionResult = {
  submission_id: number | string | null;
  state: string | null;
  status_msg: string | null;
  lang: string | null;
  runtime: string | null;
  memory: string | null;
  total_correct: number | null;
  total_testcases: number | null;
  last_testcase: string | null;
  expected_output: string | null;
  code_output: string | null;
  runtime_error: string | null;
  compile_error: string | null;
};

export type SubmitSolutionPayload = {
  slug: string;
  language: string;
  code: string;
};

export type SubmitSolutionResponse = {
  ok: boolean;
  steps: SubmissionStep[];
  result: SubmissionResult | null;
  error?: string | null;
};

export type SubmissionSummary = {
  submission_id: string;
  status?: string | null;
  status_display?: string | null;
  lang?: string | null;
  lang_name?: string | null;
  runtime_display?: string | null;
  memory_display?: string | null;
  timestamp?: number | null;
  relative_time?: string | null;
  is_pending: boolean;
  runtime?: string | null;
  memory?: string | null;
  url?: string | null;
};

export type SubmissionHistoryResponse = {
  submissions: SubmissionSummary[];
  has_next: boolean;
};
