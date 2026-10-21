const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

function getHeaders() {
  const token = localStorage.getItem('zkm_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: Request failed`);
  }
  return data;
}

export const api = {
  auth: {
    async register({ name, email, password, publicKey }) {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, publicKey }),
      });
      return handleResponse(res);
    },

    async login({ email, password }) {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(res);
    },

    async getMe() {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    async updatePublicKey(publicKey) {
      const res = await fetch(`${API_BASE}/auth/public-key`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ publicKey }),
      });
      return handleResponse(res);
    },
  },

  users: {
    async lookup(zkmId) {
      const res = await fetch(`${API_BASE}/users/lookup/${encodeURIComponent(zkmId)}`, {
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },

  friends: {
    async sendRequest({ receiverZkmId, receiverId }) {
      const res = await fetch(`${API_BASE}/friends/request`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ receiverZkmId, receiverId }),
      });
      return handleResponse(res);
    },

    async getRequests() {
      const res = await fetch(`${API_BASE}/friends/requests`, {
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    async acceptRequest(requestId) {
      const res = await fetch(`${API_BASE}/friends/requests/${requestId}/accept`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    async rejectRequest(requestId) {
      const res = await fetch(`${API_BASE}/friends/requests/${requestId}/reject`, {
        method: 'POST',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    async getFriendsList() {
      const res = await fetch(`${API_BASE}/friends/list`, {
        headers: getHeaders(),
      });
      return handleResponse(res);
    },

    async removeFriend(friendId) {
      const res = await fetch(`${API_BASE}/friends/${friendId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return handleResponse(res);
    },
  },
};
