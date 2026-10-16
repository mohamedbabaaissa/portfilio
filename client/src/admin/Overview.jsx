import { Link } from 'react-router-dom';
import { ADMIN_BASE } from '../config';
import { formatAdded, useAdminData } from '../hooks';

export default function Overview() {
  const { data, error } = useAdminData();

  if (error) return <p className="note err">{error}</p>;
  if (!data) return <p className="note">Loading…</p>;

  const { projects, profile } = data;
  const withImage = projects.filter((p) => p.image).length;
  const tags = new Set(projects.flatMap((p) => p.tags.map((t) => t.toLowerCase())));
  const recent = projects.slice(0, 4);

  const stats = [
    { label: 'Projects', value: projects.length },
    { label: 'With an image', value: withImage },
    { label: 'Tags in use', value: tags.size },
    { label: 'Profile photo', value: profile.photo ? 'Set' : 'Not set' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="sub">Here is what your portfolio shows right now.</p>
        </div>
        <Link className="btn btn-primary" to={`${ADMIN_BASE}/projects?new=1`}>
          Add project
        </Link>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <div className="card stat" key={s.label}>
            <p>{s.label}</p>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>

      <div className="grid overview-grid">
        <section className="card">
          <div className="card-head">
            <h2>Recent projects</h2>
            <Link className="text-link" to={`${ADMIN_BASE}/projects`}>
              See all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="empty">No projects yet. Add your first project to show it on your site.</p>
          ) : (
            <ul className="rows">
              {recent.map((p) => (
                <li className="row" key={p.id}>
                  <span className="thumb thumb-sm">{p.image && <img src={p.image} alt="" />}</span>
                  <div className="row-text">
                    <strong>{p.title}</strong>
                    <span>Added {formatAdded(p.createdAt)}</span>
                  </div>
                  <Link className="btn btn-sm" to={`${ADMIN_BASE}/projects?edit=${p.id}`}>
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="stack">
          <section className="card">
            <h2>Quick actions</h2>
            <div className="actions">
              <Link className="btn btn-left" to={`${ADMIN_BASE}/profile`}>
                Change my photo
              </Link>
              <Link className="btn btn-left" to={`${ADMIN_BASE}/profile`}>
                Edit my info
              </Link>
              <Link className="btn btn-left" to={`${ADMIN_BASE}/projects?new=1`}>
                Add a project
              </Link>
            </div>
          </section>
          <section className="session">
            <h2>Your session</h2>
            <p>You stay logged in for 12 hours. Log out when you use a shared computer.</p>
          </section>
        </div>
      </div>
    </>
  );
}
