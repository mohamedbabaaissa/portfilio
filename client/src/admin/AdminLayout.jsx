import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faFolder,
  faRightFromBracket,
  faTableCellsLarge,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { useEffect } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ADMIN_BASE } from '../config';

const links = [
  { to: `${ADMIN_BASE}/overview`, label: 'Overview', icon: faTableCellsLarge },
  { to: `${ADMIN_BASE}/projects`, label: 'Projects', icon: faFolder },
  { to: `${ADMIN_BASE}/profile`, label: 'Profile and photo', icon: faUser },
];

export default function AdminLayout() {
  const { status, logout } = useAuth();

  useEffect(() => {
    document.title = 'Portfolio admin';
  }, []);

  if (status === 'loading') return <div className="adm adm-loading">Loading…</div>;
  if (status === 'out') return <Navigate to={ADMIN_BASE} replace />;

  return (
    <div className="adm shell">
      <aside className="side">
        <p className="adm-brand">Portfolio admin</p>
        <nav className="side-nav" aria-label="Admin">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
              <FontAwesomeIcon icon={l.icon} fixedWidth />
              {l.label}
            </NavLink>
          ))}
          <a className="side-link" href="/" target="_blank" rel="noopener noreferrer">
            <FontAwesomeIcon icon={faArrowUpRightFromSquare} fixedWidth />
            View site
          </a>
        </nav>
        <button className="side-link side-logout" type="button" onClick={logout}>
          <FontAwesomeIcon icon={faRightFromBracket} fixedWidth />
          Log out
        </button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
