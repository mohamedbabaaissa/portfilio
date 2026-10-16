import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ADMIN_BASE } from '../config';

export default function Login() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = 'Portfolio admin';
  }, []);

  if (status === 'in') return <Navigate to={`${ADMIN_BASE}/overview`} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      navigate(`${ADMIN_BASE}/overview`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="adm login">
      <section className="login-side">
        <p className="adm-brand">Portfolio admin</p>
        <div>
          <h1>Edit your site from one place.</h1>
          <p>Change your photo and info, add new projects and keep your portfolio up to date.</p>
        </div>
        <p className="login-path">
          {window.location.host}
          {ADMIN_BASE}
        </p>
      </section>

      <section className="login-main">
        <form className="login-form" onSubmit={submit}>
          <h2>Log in</h2>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
          {error && (
            <p className="note err" role="alert">
              {error}
            </p>
          )}
          <p className="login-hint">After 5 wrong attempts, login is locked for 15 minutes.</p>
        </form>
      </section>
    </div>
  );
}
