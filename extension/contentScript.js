const RESPONSE_TYPE = 'LEETCODE_FETCH_COOKIES_RESPONSE'
const REQUEST_TYPE = 'LEETCODE_FETCH_COOKIES_REQUEST'

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.type !== REQUEST_TYPE) {
    return
  }

  chrome.runtime.sendMessage({ type: 'LEETCODE_FETCH_COOKIES' }, (response) => {
    if (chrome.runtime.lastError) {
      window.postMessage(
        {
          type: RESPONSE_TYPE,
          payload: {
            ok: false,
            error: chrome.runtime.lastError.message,
          },
        },
        '*',
      )
      return
    }

    window.postMessage(
      {
        type: RESPONSE_TYPE,
        payload: response ?? { ok: false, error: 'No response from extension.' },
      },
      '*',
    )
  })
})
