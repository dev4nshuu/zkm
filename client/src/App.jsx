import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';

export function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('zkm_token') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verifySession() {
      const storedToken = localStorage.getItem('zkm_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.auth.getMe();
        setCurrentUser(data.user);
        setToken(storedToken);
      } catch (err) {
        console.warn('[App] Session check failed:', err.message);
        localStorage.removeItem('zkm_token');
        setToken('');
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    }

    verifySession();
  }, []);

  const handleAuthSuccess = (user, jwtToken) => {
    setCurrentUser(user);
    setToken(jwtToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('zkm_token');
    setToken('');
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          fontSize: 14,
        }}
      >
        Initializing ZKM Zero-Knowledge Environment...
      </div>
    );
  }

  if (!currentUser || !token) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <DashboardPage
      currentUser={currentUser}
      token={token}
      onLogout={handleLogout}
    />
  );
}

export default App;
