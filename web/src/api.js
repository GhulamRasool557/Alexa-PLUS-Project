const KEY_STORAGE = 'jarvis.apiKey'

export function getApiKey() {
  try {
    return localStorage.getItem(KEY_STORAGE) || ''
  } catch {
    return ''
  }
}

export function setApiKey(key) {
  try {
    localStorage.setItem(KEY_STORAGE, key)
  } catch {
    // Private mode: the key just won't be remembered.
  }
}

async function request(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-api-key': getApiKey(), ...options.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(body.error || res.statusText), { status: res.status })
  return body
}

export const checkAuth = () => request('/api/auth')
export const sendCommand = (text) => request('/api/command', { method: 'POST', body: JSON.stringify({ text }) })
export const searchYouTube = (q) => request(`/api/youtube/search?q=${encodeURIComponent(q)}`)
export const getTodos = () => request('/api/todos')
export const addTodo = (text) => request('/api/todos', { method: 'POST', body: JSON.stringify({ text }) })
export const completeTodo = (id) => request(`/api/todos/${id}/done`, { method: 'POST' })
export const getReminders = () => request('/api/reminders')
export const getHistory = () => request('/api/history')
