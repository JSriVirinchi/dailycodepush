from typing import Literal, Optional

from pydantic import BaseModel, HttpUrl


class Tag(BaseModel):
  name: str
  slug: str


class POTD(BaseModel):
  date: str
  link: HttpUrl
  title: str
  slug: str
  frontendId: str
  difficulty: Literal['Easy', 'Medium', 'Hard']
  acRate: float
  tags: list[Tag]


class ReferenceItem(BaseModel):
  title: str
  url: HttpUrl
  votes: Optional[int] = None
  language: Optional[str] = None
  source: str


class ReferencesResponse(BaseModel):
  slug: str
  language: Optional[str]
  items: list[ReferenceItem]
  community_solution: Optional['CommunitySolution'] = None


class CommunitySolution(BaseModel):
  id: int
  title: str
  url: HttpUrl
  votes: Optional[int]
  language: Optional[str]
  code: Optional[str] = None
  content: Optional[str] = None


ReferencesResponse.model_rebuild()


class LeetCodeSessionPayload(BaseModel):
  leetcode_session: str
  csrf_token: str


class SubmissionStep(BaseModel):
  step: str
  status: Literal['info', 'success', 'error']
  detail: Optional[str] = None


class SubmissionResult(BaseModel):
  submission_id: Optional[int] = None
  state: Optional[str] = None
  status_msg: Optional[str] = None
  lang: Optional[str] = None
  runtime: Optional[str] = None
  memory: Optional[str] = None
  total_correct: Optional[int] = None
  total_testcases: Optional[int] = None
  last_testcase: Optional[str] = None
  expected_output: Optional[str] = None
  code_output: Optional[str] = None
  runtime_error: Optional[str] = None
  compile_error: Optional[str] = None


class SubmitSolutionPayload(BaseModel):
  slug: str
  language: str
  code: str


class SubmitSolutionResponse(BaseModel):
  ok: bool
  steps: list[SubmissionStep]
  result: Optional[SubmissionResult] = None
  error: Optional[str] = None


class SubmissionSummary(BaseModel):
  submission_id: str
  status: Optional[str] = None
  status_display: Optional[str] = None
  lang: Optional[str] = None
  lang_name: Optional[str] = None
  runtime_display: Optional[str] = None
  memory_display: Optional[str] = None
  timestamp: Optional[int] = None
  relative_time: Optional[str] = None
  is_pending: bool = False
  runtime: Optional[str] = None
  memory: Optional[str] = None
  url: Optional[HttpUrl] = None


class SubmissionHistoryResponse(BaseModel):
  submissions: list[SubmissionSummary]
  has_next: bool
