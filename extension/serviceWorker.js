chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'LEETCODE_FETCH_COOKIES') {
    return;
  }

  chrome.cookies.getAll({ domain: 'leetcode.com' }, (cookies) => {
    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        error: chrome.runtime.lastError.message,
      });
      return;
    }

    const sessionCookie = cookies.find((cookie) => cookie.name === 'LEETCODE_SESSION');
    const csrfCookie = cookies.find((cookie) => cookie.name === 'csrftoken');

    sendResponse({
      ok: Boolean(sessionCookie && csrfCookie),
      leetcodeSession: sessionCookie?.value ?? null,
      csrfToken: csrfCookie?.value ?? null,
    });
  });

  return true; // keep channel open for async response
});
