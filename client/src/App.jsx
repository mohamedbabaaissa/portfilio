import { Route, Routes } from 'react-router-dom';
import { AuthShell } from './auth.jsx';
import { ADMIN_BASE } from './config.js';
import AdminLayout from './admin/AdminLayout.jsx';
import Login from './admin/Login.jsx';
import Overview from './admin/Overview.jsx';
import Profile from './admin/Profile.jsx';
import Projects from './admin/Projects.jsx';
import Portfolio from './pages/Portfolio.jsx';

function NotFound() {
  return (
    <div className="pub pub-status">
      <p>This page does not exist.</p>
      <a href="/">Back to the portfolio</a>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portfolio />} />
      <Route path={ADMIN_BASE} element={<AuthShell />}>
        <Route index element={<Login />} />
        <Route element={<AdminLayout />}>
          <Route path="overview" element={<Overview />} />
          <Route path="projects" element={<Projects />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
