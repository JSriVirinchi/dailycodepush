from __future__ import annotations

import os
import logging
from typing import Annotated, Any, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
  LeetCodeSessionPayload,
  POTD,
  ReferencesResponse,
  SubmitSolutionPayload,
  SubmitSolutionResponse,
  SubmissionHistoryResponse,
)
from .services.leetcode import (
  LeetCodeAPIError,
  LeetCodeSubmissionError,
  build_references,
  fetch_daily_challenge,
  fetch_recent_submissions,
  get_session_override,
  set_session_override,
  submit_solution,
)

app = FastAPI(title='LeetCode Automation API', version='0.1.0')
logger = logging.getLogger(__name__)


def get_allowed_origins() -> list[str]:
  origins_env = os.getenv('FRONTEND_ORIGINS')
  if origins_env:
    return [origin.strip() for origin in origins_env.split(',') if origin.strip()]
  return ['http://localhost:5173']


ALLOWED_ORIGINS = get_allowed_origins()

app.add_middleware(
  CORSMiddleware,
  allow_origins=ALLOWED_ORIGINS,
  allow_credentials=True,
  allow_methods=['*'],
  allow_headers=['*'],
)


@app.get('/health', tags=['Health'])
async def health_check() -> dict[str, str]:
  return {'status': 'ok'}


@app.get('/api/potd', response_model=POTD, tags=['POTD'])
async def get_potd() -> POTD:
  try:
    return await fetch_daily_challenge()
  except LeetCodeAPIError as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get('/api/references', response_model=ReferencesResponse, tags=['References'])
async def get_references(
  slug: Annotated[str, Query(min_length=1)],
  lang: Annotated[Optional[str], Query()] = None,
) -> ReferencesResponse:
  try:
    return await build_references(slug, lang)
  except HTTPException:
    raise
  except Exception as exc:  # noqa: BLE001
    raise HTTPException(status_code=500, detail='Failed to build references.') from exc


@app.get('/api/leetcode/session', tags=['LeetCode Session'])
async def get_leetcode_session_status() -> dict[str, Any]:
  session_data = get_session_override()
  return {
    'connected': bool(session_data['leetcode_session'] and session_data['csrf_token']),
    'leetcode_session': session_data['leetcode_session'],
    'csrf_token': session_data['csrf_token'],
  }


@app.post('/api/leetcode/session', status_code=200, tags=['LeetCode Session'])
async def set_leetcode_session(payload: LeetCodeSessionPayload) -> dict[str, str]:
  set_session_override(payload.leetcode_session, payload.csrf_token)
  return {'status': 'ok'}


@app.delete('/api/leetcode/session', status_code=200, tags=['LeetCode Session'])
async def clear_leetcode_session() -> dict[str, str]:
  set_session_override(None, None)
  return {'status': 'ok'}


@app.get('/api/leetcode/submissions', response_model=SubmissionHistoryResponse, tags=['LeetCode Submission'])
async def get_leetcode_submissions(
  slug: Annotated[str, Query(min_length=1)],
  limit: Annotated[int, Query(gt=0, le=50)] = 20,
) -> SubmissionHistoryResponse:
  try:
    submissions, has_next = await fetch_recent_submissions(slug, limit)
    return SubmissionHistoryResponse(submissions=submissions, has_next=has_next)
  except LeetCodeAPIError as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc
  except Exception as exc:  # noqa: BLE001
    logger.exception('Unexpected error while loading submissions for %s', slug)
    raise HTTPException(status_code=500, detail=f'Failed to load submission history: {exc}') from exc


@app.post('/api/leetcode/submit', response_model=SubmitSolutionResponse, tags=['LeetCode Submission'])
async def submit_leetcode_solution(payload: SubmitSolutionPayload) -> SubmitSolutionResponse:
  try:
    steps, result = await submit_solution(payload.slug, payload.language, payload.code)
    return SubmitSolutionResponse(ok=True, steps=steps, result=result)
  except LeetCodeSubmissionError as exc:
    return SubmitSolutionResponse(ok=False, steps=exc.steps, error=str(exc))
  except LeetCodeAPIError as exc:
    return SubmitSolutionResponse(ok=False, steps=[], error=str(exc))
  except Exception as exc:  # noqa: BLE001
    logger.exception('Unexpected error during submission for %s', payload.slug)
    return SubmitSolutionResponse(ok=False, steps=[], error=f'Unexpected error while submitting to LeetCode: {exc}')
