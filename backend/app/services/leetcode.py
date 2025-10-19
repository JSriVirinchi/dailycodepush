from __future__ import annotations

import asyncio
import functools
import logging
import os
import re
from html import unescape
from typing import Any, Iterable
from urllib.parse import urljoin

import httpx
from fastapi import HTTPException

from ..schemas import CommunitySolution, POTD, ReferenceItem, ReferencesResponse, SubmissionSummary

LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql'
LEETCODE_BASE_URL = 'https://leetcode.com'

USER_AGENT = os.getenv(
  'LEETCODE_USER_AGENT',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)

_SESSION_OVERRIDE: dict[str, str | None] = {
  'LEETCODE_SESSION': None,
  'csrftoken': None,
}


class LeetCodeAPIError(RuntimeError):
  """Raised when the LeetCode API cannot be reached or returns invalid payloads."""


class LeetCodeSubmissionError(RuntimeError):
  """Raised when a LeetCode submission fails and captures step information."""

  def __init__(self, message: str, steps: list[dict[str, Any]]) -> None:
    super().__init__(message)
    self.steps = steps


logger = logging.getLogger(__name__)

LANGUAGE_MAPPINGS: dict[str, dict[str, Any]] = {
  'python': {'slug': 'python', 'aliases': ['python', 'python3', 'py']},
  'cpp': {'slug': 'cpp', 'aliases': ['cpp', 'c++', 'cxx']},
  'java': {'slug': 'java', 'aliases': ['java']},
  'javascript': {'slug': 'javascript', 'aliases': ['javascript', 'js']},
  'typescript': {'slug': 'typescript', 'aliases': ['typescript', 'ts']},
  'c': {'slug': 'c', 'aliases': ['c']},
  'csharp': {'slug': 'csharp', 'aliases': ['csharp', 'c#', 'cs']},
  'go': {'slug': 'golang', 'aliases': ['golang', 'go']},
  'rust': {'slug': 'rust', 'aliases': ['rust']},
  'kotlin': {'slug': 'kotlin', 'aliases': ['kotlin']},
  'swift': {'slug': 'swift', 'aliases': ['swift']},
}

SUBMISSION_LANGUAGE_CODES: dict[str, str] = {
  'python': 'python3',
  'python3': 'python3',
  'py': 'python3',
  'cpp': 'cpp',
  'c++': 'cpp',
  'cxx': 'cpp',
  'java': 'java',
  'javascript': 'javascript',
  'js': 'javascript',
  'typescript': 'typescript',
  'ts': 'typescript',
  'c': 'c',
  'csharp': 'csharp',
  'c#': 'csharp',
  'cs': 'csharp',
  'golang': 'golang',
  'go': 'golang',
  'rust': 'rust',
  'kotlin': 'kotlin',
  'swift': 'swift',
}

LANGUAGE_HEURISTICS: dict[str, Any] = {
  'python': lambda snippet, lower: 'def ' in lower or lower.startswith('class ') or re.search(r':\n', snippet) is not None,
  'py': lambda snippet, lower: 'def ' in lower or lower.startswith('class ') or re.search(r':\n', snippet) is not None,
  'java': lambda snippet, lower: 'class ' in snippet and ';' in snippet and ('public ' in lower or 'private ' in lower),
  'cpp': lambda snippet, lower: '#include' in lower or 'std::' in snippet or re.search(r'\btemplate\b', lower) is not None,
  'c++': lambda snippet, lower: '#include' in lower or 'std::' in snippet or re.search(r'\btemplate\b', lower) is not None,
  'csharp': lambda snippet, lower: 'using System' in snippet or 'namespace ' in lower or 'public class' in lower,
  'c#': lambda snippet, lower: 'using System' in snippet or 'namespace ' in lower or 'public class' in lower,
  'cs': lambda snippet, lower: 'using System' in snippet or 'namespace ' in lower or 'public class' in lower,
  'javascript': lambda snippet, lower: 'function ' in lower or 'const ' in lower and '=>' in snippet or 'module.exports' in lower,
  'js': lambda snippet, lower: 'function ' in lower or 'const ' in lower and '=>' in snippet or 'module.exports' in lower,
  'typescript': lambda snippet, lower: 'interface ' in lower or 'type ' in lower or 'const ' in lower and '=>' in snippet,
  'ts': lambda snippet, lower: 'interface ' in lower or 'type ' in lower or 'const ' in lower and '=>' in snippet,
  'golang': lambda snippet, lower: lower.startswith('package ') or 'func ' in lower,
  'go': lambda snippet, lower: lower.startswith('package ') or 'func ' in lower,
  'rust': lambda snippet, lower: 'fn ' in lower and 'let ' in lower,
  'kotlin': lambda snippet, lower: 'fun ' in lower or 'val ' in lower,
  'swift': lambda snippet, lower: 'let ' in lower and 'func ' in lower or 'import Foundation' in lower,
  'c': lambda snippet, lower: '#include' in lower or 'int main' in lower,
}

COMMUNITY_SOLUTIONS_QUERY = """
query questionSolutions($filters: QuestionSolutionsFilterInput!) {
  questionSolutions(filters: $filters) {
    solutions {
      id
      title
      viewCount
      solutionTags {
        slug
        name
      }
      post {
        id
        content
        voteCount
        voteUpCount
      }
    }
  }
}
"""

QUESTION_DETAIL_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    questionTitle
  }
}
"""

CODE_FENCE_PATTERN = re.compile(r"```(?P<info>[^\n]*)\n(?P<body>.*?)```", re.DOTALL)
HTML_CODE_PATTERN = re.compile(
  r'<code[^>]*class="([^"]*)"[^>]*>(.*?)</code>',
  re.IGNORECASE | re.DOTALL,
)
HTML_PRE_PATTERN = re.compile(
  r'<pre[^>]*data-language="([^"]+)"[^>]*>(.*?)</pre>',
  re.IGNORECASE | re.DOTALL,
)


def _get_active_credentials() -> tuple[str | None, str | None]:
  session_cookie = (_SESSION_OVERRIDE.get('LEETCODE_SESSION') or os.getenv('LEETCODE_SESSION') or '').strip() or None
  csrf_token = (_SESSION_OVERRIDE.get('csrftoken') or os.getenv('LEETCODE_CSRF_TOKEN') or '').strip() or None
  return session_cookie, csrf_token


@functools.lru_cache(maxsize=1)
def _graphql_headers() -> dict[str, str]:
  headers = {
    'Content-Type': 'application/json',
    'Referer': LEETCODE_BASE_URL,
    'User-Agent': USER_AGENT,
    'Origin': LEETCODE_BASE_URL,
    'Accept': 'application/json',
  }
  session_cookie, csrf_token = _get_active_credentials()
  if csrf_token:
    headers['x-csrftoken'] = csrf_token
  if session_cookie or csrf_token:
    cookie_values = []
    if session_cookie:
      cookie_values.append(f'LEETCODE_SESSION={session_cookie}')
    if csrf_token:
      cookie_values.append(f'csrftoken={csrf_token}')
    headers['Cookie'] = '; '.join(cookie_values)
  return headers


def _build_auth_headers(
  referer: str | None = None,
  *,
  include_content_type: bool = True,
  include_xhr: bool = False,
) -> dict[str, str]:
  headers = {
    'User-Agent': USER_AGENT,
    'Origin': LEETCODE_BASE_URL,
    'Accept': 'application/json',
    'Referer': referer or LEETCODE_BASE_URL,
  }
  if include_content_type:
    headers['Content-Type'] = 'application/json'
  if include_xhr:
    headers['X-Requested-With'] = 'XMLHttpRequest'
  session_cookie, csrf_token = _get_active_credentials()
  if csrf_token:
    headers['x-csrftoken'] = csrf_token
  if session_cookie or csrf_token:
    cookie_values = []
    if session_cookie:
      cookie_values.append(f'LEETCODE_SESSION={session_cookie}')
    if csrf_token:
      cookie_values.append(f'csrftoken={csrf_token}')
    headers['Cookie'] = '; '.join(cookie_values)
  return headers


def set_session_override(session: str | None, csrf_token: str | None) -> None:
  _SESSION_OVERRIDE['LEETCODE_SESSION'] = session.strip() if session else None
  _SESSION_OVERRIDE['csrftoken'] = csrf_token.strip() if csrf_token else None
  _graphql_headers.cache_clear()


def get_session_override() -> dict[str, str | None]:
  return {
    'leetcode_session': _SESSION_OVERRIDE.get('LEETCODE_SESSION'),
    'csrf_token': _SESSION_OVERRIDE.get('csrftoken'),
  }


def _stringify(value: Any) -> str | None:
  if value is None:
    return None
  if isinstance(value, str):
    stripped = value.strip()
    return stripped if stripped else value
  return str(value)


async def fetch_daily_challenge() -> POTD:
  query = """
  query questionOfToday {
    activeDailyCodingChallengeQuestion {
      date
      link
      question {
        questionFrontendId
        questionTitle
        questionTitleSlug
        acRate
        difficulty
        topicTags {
          name
          slug
        }
      }
    }
  }
  """

  async with httpx.AsyncClient(timeout=15.0) as client:
    response = await client.post(
      LEETCODE_GRAPHQL_URL,
      json={'query': query},
      headers=_graphql_headers(),
    )

  try:
    response.raise_for_status()
  except httpx.HTTPStatusError as exc:
    raise LeetCodeAPIError(f'GraphQL request failed with status {response.status_code}') from exc

  data: dict[str, Any] = response.json()

  challenge = data.get('data', {}).get('activeDailyCodingChallengeQuestion')
  if not challenge or 'question' not in challenge:
    raise LeetCodeAPIError('Unexpected response structure from LeetCode GraphQL API.')

  question = challenge['question']

  link = challenge.get('link') or f"/problems/{question.get('questionTitleSlug', '')}/"
  link = f'{LEETCODE_BASE_URL}{link}' if link.startswith('/') else link

  try:
    potd = POTD(
      date=challenge['date'],
      link=link,
      title=question['questionTitle'],
      slug=question['questionTitleSlug'],
      frontendId=str(question['questionFrontendId']),
      difficulty=question['difficulty'],
      acRate=float(question['acRate']),
      tags=[
        {'name': tag['name'], 'slug': tag['slug']}
        for tag in question.get('topicTags', [])
      ],
    )
  except Exception as exc:  # noqa: BLE001
    raise LeetCodeAPIError('Failed to parse POTD payload from LeetCode.') from exc

  return potd


def _normalize_language_key(value: str) -> str:
  return re.sub(r'[^a-z0-9+#]+', '', value.lower())


def _resolve_language(language: str | None) -> tuple[str | None, str | None, list[str]]:
  if not language:
    return None, None, []

  key = language.strip().lower()
  if not key:
    return None, None, []

  config = LANGUAGE_MAPPINGS.get(key)
  if not config:
    normalized = _normalize_language_key(key)
    return normalized or key, key, [key]

  slug = config['slug']
  aliases = {_normalize_language_key(alias) for alias in config.get('aliases', []) if alias}
  aliases.add(_normalize_language_key(slug))
  aliases.add(_normalize_language_key(key))
  return slug, key, [alias for alias in aliases if alias]


def _resolve_submission_language(language: str | None) -> str | None:
  if not language:
    return None

  normalized = _normalize_language_key(language)
  if not normalized:
    return None

  if normalized in SUBMISSION_LANGUAGE_CODES:
    return SUBMISSION_LANGUAGE_CODES[normalized]

  for key, config in LANGUAGE_MAPPINGS.items():
    aliases = {key, config.get('slug', key)}
    aliases.update(_normalize_language_key(alias) for alias in config.get('aliases', []) if alias)
    normalized_aliases = {_normalize_language_key(alias) for alias in aliases if alias}
    if normalized in normalized_aliases:
      primary = _normalize_language_key(config.get('slug', key))
      if primary in SUBMISSION_LANGUAGE_CODES:
        return SUBMISSION_LANGUAGE_CODES[primary]
      if key in SUBMISSION_LANGUAGE_CODES:
        return SUBMISSION_LANGUAGE_CODES[key]

  return SUBMISSION_LANGUAGE_CODES.get(normalized)


def _extract_code_snippet(markdown: str, aliases: list[str]) -> str | None:
  if not markdown or not aliases:
    return None

  normalized_aliases = _normalize_aliases(aliases)
  if not normalized_aliases:
    return None

  snippet = _extract_from_markdown_fences(markdown, normalized_aliases)
  if snippet:
    return snippet

  snippet = _extract_from_html_blocks(markdown, normalized_aliases)
  if snippet:
    return snippet

  return None


def _normalize_aliases(aliases: Iterable[str]) -> set[str]:
  normalized: set[str] = set()
  for alias in aliases:
    key = _normalize_language_key(alias)
    if not key:
      continue
    normalized.add(key)
  return normalized


def _info_matches_language(info: str, normalized_aliases: set[str]) -> bool:
  key = _normalize_language_key(info)
  if not key:
    return False
  if key in normalized_aliases:
    return True
  return any(alias in key or key in alias for alias in normalized_aliases)


def _context_mentions_language(markdown: str, start_index: int, normalized_aliases: set[str]) -> bool:
  snippet_context = markdown[:start_index]
  context_lines = snippet_context.splitlines()[-6:]
  for line in reversed(context_lines):
    normalized_line = _normalize_language_key(line)
    if not normalized_line:
      continue
    if any(alias in normalized_line or normalized_line in alias for alias in normalized_aliases):
      return True
  return False


def _extract_from_markdown_fences(markdown: str, normalized_aliases: set[str]) -> str | None:
  fallback_snippet: str | None = None
  for match in CODE_FENCE_PATTERN.finditer(markdown):
    info_raw = match.group('info') or ''
    body = match.group('body').rstrip()
    if fallback_snippet is None and body.strip():
      fallback_snippet = body
    if _info_matches_language(info_raw, normalized_aliases):
      return body or None
    if not info_raw.strip():
      if _context_mentions_language(markdown, match.start(), normalized_aliases):
        return body or None
      if _looks_like_language(body, normalized_aliases):
        return body or None
  return fallback_snippet


def _extract_from_html_blocks(markdown: str, normalized_aliases: set[str]) -> str | None:
  fallback_snippet: str | None = None
  for match in HTML_CODE_PATTERN.finditer(markdown):
    class_attr = match.group(1) or ''
    if not _info_matches_language(class_attr, normalized_aliases):
      snippet = _clean_html_snippet(match.group(2))
      if fallback_snippet is None and snippet:
        fallback_snippet = snippet
      continue
    snippet = _clean_html_snippet(match.group(2))
    if snippet:
      return snippet

  for match in HTML_PRE_PATTERN.finditer(markdown):
    data_lang = match.group(1) or ''
    if not _info_matches_language(data_lang, normalized_aliases):
      snippet = _clean_html_snippet(match.group(2))
      if fallback_snippet is None and snippet:
        fallback_snippet = snippet
      continue
    snippet = _clean_html_snippet(match.group(2))
    if snippet:
      return snippet

  return fallback_snippet


def _clean_html_snippet(raw: str | None) -> str | None:
  if not raw:
    return None
  snippet = re.sub(r'(?i)<br\s*/?>', '\n', raw)
  snippet = re.sub(r'(?i)</p>', '\n', snippet)
  snippet = re.sub(r'<[^>]+>', '', snippet)
  snippet = unescape(snippet)
  snippet = snippet.strip('\n')
  return snippet or None


def _looks_like_language(snippet: str, normalized_aliases: set[str]) -> bool:
  snippet_clean = snippet.strip()
  if not snippet_clean:
    return False
  snippet_lower = snippet_clean.lower()
  for alias in normalized_aliases:
    matcher = LANGUAGE_HEURISTICS.get(alias)
    if matcher and matcher(snippet_clean, snippet_lower):
      return True
  return False


async def _fetch_top_community_solution(
  slug: str,
  language_tag: str | None,
  aliases: list[str],
  preferred_language: str | None,
) -> CommunitySolution | None:
  filters: dict[str, Any] = {
    'questionSlug': slug,
    'skip': 0,
    'first': 10,
    'orderBy': 'most_votes',
  }
  if language_tag:
    filters['languageTags'] = [language_tag]

  async with httpx.AsyncClient(timeout=15.0) as client:
    response = await client.post(
      LEETCODE_GRAPHQL_URL,
      json={'query': COMMUNITY_SOLUTIONS_QUERY, 'variables': {'filters': filters}},
      headers=_graphql_headers(),
    )

  try:
    response.raise_for_status()
  except httpx.HTTPStatusError as exc:
    raise LeetCodeAPIError(
      f'Community solutions request failed with status {response.status_code}'
    ) from exc

  payload = response.json()
  errors = payload.get('errors')
  if errors:
    messages = ', '.join(error.get('message', 'unknown error') for error in errors)
    raise LeetCodeAPIError(f'Community solutions query returned errors: {messages}')

  solutions = payload.get('data', {}).get('questionSolutions', {}).get('solutions', [])
  if not solutions:
    return None

  normalized_aliases = _normalize_aliases(aliases)

  selected_solution = None
  selected_post: dict[str, Any] = {}
  code_snippet: str | None = None

  for candidate in solutions:
    candidate_post = candidate.get('post') or {}
    candidate_content = candidate_post.get('content') or ''
    candidate_snippet = _extract_code_snippet(candidate_content, aliases)
    if candidate_snippet:
      selected_solution = candidate
      selected_post = candidate_post
      code_snippet = candidate_snippet
      break
    if selected_solution is None:
      selected_solution = candidate
      selected_post = candidate_post
      code_snippet = candidate_snippet

  if not selected_solution:
    return None

  vote_count = selected_post.get('voteCount')
  try:
    votes = int(vote_count) if vote_count is not None else None
  except (TypeError, ValueError):
    votes = None

  content = selected_post.get('content') or ''

  try:
    solution_id = int(selected_solution.get('id'))
  except (TypeError, ValueError):
    raise LeetCodeAPIError('Invalid solution identifier returned by LeetCode.')

  url = f'{LEETCODE_BASE_URL}/problems/{slug}/solutions/{solution_id}/'

  resolved_language = preferred_language
  if normalized_aliases:
    for tag in selected_solution.get('solutionTags', []) or []:
      tag_slug = _normalize_language_key(tag.get('slug', '') or '')
      tag_name = tag.get('name')
      if tag_slug and any(alias in tag_slug or tag_slug in alias for alias in normalized_aliases):
        resolved_language = tag_name or tag.get('slug') or preferred_language
        break

  return CommunitySolution(
    id=solution_id,
    title=selected_solution.get('title') or 'Community Solution',
    url=url,
    votes=votes,
    language=resolved_language,
    code=code_snippet,
    content=content or None,
  )


async def fetch_question_identifiers(slug: str) -> dict[str, Any]:
  normalized_slug = slug.strip()
  if not normalized_slug:
    raise LeetCodeAPIError('Question slug is required to fetch metadata.')

  async with httpx.AsyncClient(timeout=15.0) as client:
    response = await client.post(
      LEETCODE_GRAPHQL_URL,
      json={'query': QUESTION_DETAIL_QUERY, 'variables': {'titleSlug': normalized_slug}},
      headers=_graphql_headers(),
    )

  try:
    response.raise_for_status()
  except httpx.HTTPStatusError as exc:
    raise LeetCodeAPIError(
      f'Question metadata request failed with status {response.status_code}'
    ) from exc

  payload = response.json()
  question = payload.get('data', {}).get('question')
  if not question:
    raise LeetCodeAPIError(f'Question metadata missing for slug "{normalized_slug}".')

  if not question.get('questionId'):
    raise LeetCodeAPIError(f'Question ID not found for slug "{normalized_slug}".')

  return question


async def submit_solution(slug: str, language: str, code: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
  steps: list[dict[str, Any]] = []

  def add_step(step: str, status: str, detail: str | None = None) -> None:
    steps.append({'step': step, 'status': status, 'detail': detail})

  add_step('start', 'info', 'Starting submission workflow.')

  try:
    normalized_slug = slug.strip()
    if not normalized_slug:
      add_step('validate-request', 'error', 'Question slug is required.')
      raise LeetCodeSubmissionError('Question slug is required.', steps)

    trimmed_code = code.rstrip()
    if not trimmed_code:
      add_step('prepare-code', 'error', 'Code snippet is empty.')
      raise LeetCodeSubmissionError('Code snippet is empty.', steps)

    submit_lang = _resolve_submission_language(language)
    if not submit_lang:
      add_step('resolve-language', 'error', f'Unsupported language "{language}".')
      raise LeetCodeSubmissionError(f'Unsupported language "{language}".', steps)

    add_step('resolve-language', 'success', f'Using {submit_lang} for submission.')

    session_cookie, csrf_token = _get_active_credentials()
    if not session_cookie or not csrf_token:
      add_step('validate-session', 'error', 'Missing LEETCODE_SESSION or csrftoken.')
      raise LeetCodeSubmissionError(
        'LeetCode session cookies are not configured. Fetch them from the extension and try again.',
        steps,
      )

    add_step('validate-session', 'success', 'LeetCode session detected.')

    try:
      question = await fetch_question_identifiers(normalized_slug)
      question_id = str(question.get('questionId'))
      add_step('fetch-question', 'success', f"Resolved question id {question_id}.")
    except LeetCodeAPIError as exc:
      add_step('fetch-question', 'error', str(exc))
      raise LeetCodeSubmissionError(str(exc), steps) from exc

    referer_url = f'{LEETCODE_BASE_URL}/problems/{normalized_slug}/'
    headers = _build_auth_headers(referer=referer_url, include_xhr=True)
    submission_payload = {
      'lang': submit_lang,
      'question_id': question_id,
      'typed_code': trimmed_code,
      'data_input': '',
      'test_mode': False,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
      response = await client.post(
        f'{LEETCODE_BASE_URL}/problems/{normalized_slug}/submit/',
        json=submission_payload,
        headers=headers,
      )

    try:
      response.raise_for_status()
    except httpx.HTTPStatusError as exc:
      detail_text = f'Submission request failed with status {response.status_code}.'
      add_step('submit', 'error', detail_text)
      raise LeetCodeSubmissionError(detail_text, steps) from exc

    try:
      submission_response = response.json()
    except ValueError as exc:
      add_step('submit', 'error', 'LeetCode returned an unexpected response to the submit request.')
      raise LeetCodeSubmissionError('LeetCode returned a non-JSON response when submitting the code.', steps) from exc
    submission_id = submission_response.get('submission_id') or submission_response.get('submissionId')
    if not submission_id:
      detail_text = 'LeetCode did not return a submission id.'
      add_step('submit', 'error', detail_text)
      raise LeetCodeSubmissionError(detail_text, steps)

    add_step('submit', 'success', f'Submission created with id {submission_id}.')

    check_url = f'{LEETCODE_BASE_URL}/submissions/detail/{submission_id}/check/'
    result_payload: dict[str, Any] | None = None

    async with httpx.AsyncClient(timeout=30.0) as client:
      attempts = 0
      while attempts < 20:
        attempts += 1
        await asyncio.sleep(1.5)
        check_response = await client.get(check_url, headers=headers)
        try:
          check_response.raise_for_status()
        except httpx.HTTPStatusError as exc:
          detail_text = f'Check request failed with status {check_response.status_code}.'
          add_step('check', 'error', detail_text)
          raise LeetCodeSubmissionError(detail_text, steps) from exc

        try:
          result_payload = check_response.json()
        except ValueError as exc:
          add_step('check', 'error', 'LeetCode returned a non-JSON response when checking submission status.')
          raise LeetCodeSubmissionError('LeetCode returned a non-JSON check response.', steps) from exc
        state = (result_payload.get('state') or '').upper()
        if state in {'PENDING', 'STARTED'}:
          if attempts % 3 == 0:
            add_step('check', 'info', f'Waiting for evaluation (state: {state}).')
          continue
        break

    if not result_payload or (result_payload.get('state') or '').upper() in {'PENDING', 'STARTED'}:
      detail_text = 'Timed out while waiting for submission result.'
      add_step('check', 'error', detail_text)
      raise LeetCodeSubmissionError(detail_text, steps)

    state = (result_payload.get('state') or '').upper()
    status_msg_raw = result_payload.get('status_msg') or 'Unknown'
    status_msg = _stringify(status_msg_raw) or 'Unknown'
    detail_message = f'{status_msg} (state: {state})'

    if state == 'SUCCESS':
      if status_msg.lower() == 'accepted':
        add_step('check', 'success', detail_message)
      else:
        add_step('check', 'info', detail_message)
    else:
      add_step('check', 'error', detail_message)

    result_payload['submission_id'] = submission_id
    formatted: dict[str, Any] = {
      'submission_id': int(submission_id) if str(submission_id).isdigit() else submission_id,
      'state': state,
      'status_msg': status_msg,
      'lang': _stringify(result_payload.get('lang')),
      'runtime': _stringify(result_payload.get('runtime') or result_payload.get('status_runtime')),
      'memory': _stringify(result_payload.get('memory') or result_payload.get('status_memory')),
      'total_correct': result_payload.get('total_correct'),
      'total_testcases': result_payload.get('total_testcases'),
      'last_testcase': _stringify(result_payload.get('last_testcase') or result_payload.get('input')),
      'expected_output': _stringify(result_payload.get('expected_output')),
      'code_output': _stringify(result_payload.get('code_output')),
      'runtime_error': _stringify(result_payload.get('runtime_error') or result_payload.get('full_runtime_error')),
      'compile_error': _stringify(result_payload.get('compile_error') or result_payload.get('full_compile_error')),
    }

    if state == 'SUCCESS' and (result_payload.get('status_msg') or '').lower() == 'accepted':
      add_step('complete', 'success', 'LeetCode accepted the submission.')
    elif state == 'SUCCESS':
      add_step('complete', 'info', 'LeetCode finished processing the submission.')
    else:
      add_step('complete', 'error', 'LeetCode reported an issue with the submission.')

    return steps, formatted
  except LeetCodeSubmissionError:
    raise
  except LeetCodeAPIError as exc:
    add_step('unexpected-api-error', 'error', str(exc))
    raise LeetCodeSubmissionError(str(exc), steps) from exc
  except Exception as exc:  # noqa: BLE001
    logger.exception('Unexpected error while submitting solution for %s', slug)
    add_step('unexpected-error', 'error', str(exc))
    raise LeetCodeSubmissionError('Unexpected error while submitting to LeetCode.', steps) from exc


async def fetch_recent_submissions(slug: str, limit: int = 20) -> tuple[list[SubmissionSummary], bool]:
  normalized_slug = slug.strip()
  if not normalized_slug:
    raise LeetCodeAPIError('Question slug is required to fetch submissions.')

  session_cookie, _ = _get_active_credentials()
  if not session_cookie:
    raise LeetCodeAPIError('LeetCode session cookies are not configured. Fetch them from the extension and try again.')

  headers = _build_auth_headers(
    referer=f'{LEETCODE_BASE_URL}/problems/{normalized_slug}/submissions/',
    include_content_type=False,
    include_xhr=True,
  )
  url = f'{LEETCODE_BASE_URL}/api/submissions/{normalized_slug}/?offset=0&limit={limit}'

  async with httpx.AsyncClient(timeout=15.0) as client:
    response = await client.get(url, headers=headers)

  try:
    response.raise_for_status()
  except httpx.HTTPStatusError as exc:
    status_code = exc.response.status_code
    detail_message = f'Fetching submissions failed with status {status_code}.'
    try:
      error_payload = exc.response.json()
      if isinstance(error_payload, dict):
        message = error_payload.get('detail') or error_payload.get('message')
        if message:
          detail_message = str(message)
    except Exception:  # noqa: BLE001
      raw_text = exc.response.text
      if raw_text:
        detail_message = f'{detail_message} Response: {raw_text[:200]}'

    if status_code == 403:
      detail_message = (
        'LeetCode rejected the submissions request (HTTP 403). '
        'Double-check that your stored cookies are still valid by fetching them again from the extension.'
      )
    elif status_code == 404:
      detail_message = (
        f'LeetCode did not recognise the problem slug "{normalized_slug}". '
        'Open the problem once in the browser to refresh your permissions and try again.'
      )
    elif status_code == 429:
      detail_message = 'LeetCode rate-limited the submissions request (HTTP 429). Please wait a moment before retrying.'

    raise LeetCodeAPIError(detail_message) from exc

  try:
    payload = response.json()
  except ValueError as exc:
    raise LeetCodeAPIError(
      'LeetCode returned an unexpected (non-JSON) response when listing submissions. '
      'Open the problem in your browser to confirm your session is still active and try again.'
    ) from exc
  submissions_dump = payload.get('submissions_dump') or []
  has_next = bool(payload.get('has_next'))

  submissions: list[SubmissionSummary] = []

  for entry in submissions_dump:
    submission_id = entry.get('id') or entry.get('submission_id')
    if not submission_id:
      continue

    raw_url = entry.get('url') or None
    full_url: str | None = None
    if raw_url:
      if raw_url.startswith('http://') or raw_url.startswith('https://'):
        full_url = raw_url
      else:
        full_url = urljoin(LEETCODE_BASE_URL, raw_url)

    runtime_raw = entry.get('runtime_display') or entry.get('runtime')
    memory_raw = entry.get('memory_display') or entry.get('memory')

    submissions.append(
      SubmissionSummary(
        submission_id=str(submission_id),
        status=_stringify(entry.get('status')),
        status_display=_stringify(entry.get('status_display')),
        lang=_stringify(entry.get('lang')),
        lang_name=_stringify(entry.get('lang_name')),
        runtime_display=_stringify(runtime_raw),
        memory_display=_stringify(memory_raw),
        timestamp=entry.get('timestamp'),
        relative_time=_stringify(entry.get('time')),
        is_pending=bool(entry.get('is_pending')),
        runtime=_stringify(entry.get('runtime')),
        memory=_stringify(entry.get('memory')),
        url=full_url,
      )
    )

  return submissions, has_next


async def build_references(slug: str, language: str | None) -> ReferencesResponse:
  normalized_slug = slug.strip()
  if not normalized_slug:
    raise HTTPException(status_code=400, detail='slug is required')

  normalized_language = (language or '').strip()

  language_tag, canonical_language, language_aliases = _resolve_language(normalized_language or None)

  items: list[ReferenceItem] = [
    ReferenceItem(
      title='LeetCode Official Editorial',
      url=f'{LEETCODE_BASE_URL}/problems/{normalized_slug}/editorial/',
      votes=None,
      language=None,
      source='editorial',
    )
  ]

  community_url = f'{LEETCODE_BASE_URL}/problems/{normalized_slug}/solutions/?orderBy=most_votes'
  if language_tag:
    community_url += f'&languageTags={language_tag}'

  items.append(
    ReferenceItem(
      title='Most Voted Community Discussions',
      url=community_url,
      votes=None,
      language=canonical_language or None,
      source='solutions_index',
    )
  )

  community_solution: CommunitySolution | None = None
  try:
    community_solution = await _fetch_top_community_solution(
      normalized_slug,
      language_tag,
      language_aliases,
      canonical_language or None,
    )
  except LeetCodeAPIError as exc:
    logger.warning('Unable to fetch community solution for %s (%s): %s', normalized_slug, language_tag, exc)

  return ReferencesResponse(
    slug=normalized_slug,
    language=canonical_language or None,
    items=items,
    community_solution=community_solution,
  )
