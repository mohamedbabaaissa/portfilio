async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body
  }
  if (!res.ok) {
    if (res.status === 401 && url.startsWith('/api/admin') && !url.endsWith('/login')) {
      window.dispatchEvent(new Event('session-expired'));
    }
    const err = new Error(data?.error || 'Something went wrong. Try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  public: () => request('/api/public'),
  me: () => request('/api/admin/me'),
  login: (username, password) => request('/api/admin/login', json('POST', { username, password })),
  logout: () => request('/api/admin/logout', { method: 'POST' }),
  data: () => request('/api/admin/data'),
  saveProfile: (form) => request('/api/admin/profile', { method: 'PUT', body: form }),
  createProject: (form) => request('/api/admin/projects', { method: 'POST', body: form }),
  updateProject: (id, form) => request(`/api/admin/projects/${id}`, { method: 'PUT', body: form }),
  deleteProject: (id) => request(`/api/admin/projects/${id}`, { method: 'DELETE' }),
};

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Returns an error message, or '' when the file is fine.
export function checkImage(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Use a JPG, PNG, WebP or GIF image.';
  if (file.size > MAX_IMAGE_BYTES) return 'That image is larger than 4 MB.';
  return '';
}
