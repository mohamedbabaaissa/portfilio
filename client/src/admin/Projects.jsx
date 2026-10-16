import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, checkImage } from '../api';
import { useAdminData, useObjectUrl } from '../hooks';

const blank = { title: '', description: '', link: '', tags: '' };

const toForm = (p) => ({
  title: p.title,
  description: p.description,
  link: p.link,
  tags: p.tags.join(', '),
});

export default function Projects() {
  const { data, error, reload } = useAdminData();
  const [params, setParams] = useSearchParams();
  const editId = Number(params.get('edit')) || null;
  const editing = useMemo(() => data?.projects.find((p) => p.id === editId) || null, [data, editId]);

  const [form, setForm] = useState(blank);
  const [image, setImage] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const preview = useObjectUrl(image);

  // Load the project into the form when a different one is picked.
  useEffect(() => {
    setForm(editing ? toForm(editing) : blank);
    setImage(null);
    if (fileInput.current) fileInput.current.value = '';
  }, [editing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="note err">{error}</p>;
  if (!data) return <p className="note">Loading…</p>;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const thumb = preview || editing?.image || '';

  const reset = () => {
    setForm(blank);
    setImage(null);
    if (fileInput.current) fileInput.current.value = '';
    setParams({});
  };

  const pickImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const problem = checkImage(file);
    if (problem) {
      setMessage({ type: 'err', text: problem });
      e.target.value = '';
      return;
    }
    setImage(file);
    setMessage({ type: '', text: '' });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (image) body.append('image', image);
    try {
      const wasEditing = Boolean(editing);
      if (editing) await api.updateProject(editing.id, body);
      else await api.createProject(body);
      await reload();
      reset();
      setMessage({ type: 'ok', text: wasEditing ? 'Project saved.' : 'Project added to your site.' });
    } catch (err) {
      setMessage({ type: 'err', text: err.message });
    }
    setBusy(false);
  };

  const remove = async (project) => {
    if (!window.confirm(`Delete "${project.title}"? This removes it from your site.`)) return;
    try {
      await api.deleteProject(project.id);
      if (project.id === editId) reset();
      await reload();
      setMessage({ type: 'ok', text: 'Project deleted.' });
    } catch (err) {
      setMessage({ type: 'err', text: err.message });
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="sub">Add, edit or remove the projects shown on your site.</p>
        </div>
      </div>

      <div className="grid projects-grid">
        <form className="card" onSubmit={save}>
          <h2>{editing ? 'Edit project' : 'Add project'}</h2>
          <div className="field">
            <label htmlFor="p-title">Title</label>
            <input id="p-title" value={form.title} onChange={set('title')} required maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="p-desc">Description</label>
            <textarea id="p-desc" rows={4} value={form.description} onChange={set('description')} maxLength={600} />
          </div>
          <div className="field">
            <label htmlFor="p-link">Link</label>
            <input id="p-link" type="url" placeholder="https://" value={form.link} onChange={set('link')} />
          </div>
          <div className="field">
            <label htmlFor="p-tags">Tags, separated by commas</label>
            <input id="p-tags" value={form.tags} onChange={set('tags')} />
          </div>
          <div className="field">
            <span className="label">Project image</span>
            <div className="drop">
              <span className="thumb thumb-lg">{thumb && <img src={thumb} alt="" />}</span>
              <div>
                <button className="btn btn-sm" type="button" onClick={() => fileInput.current.click()}>
                  Choose image
                </button>
                <p className="help">JPG, PNG, WebP or GIF, up to 4 MB</p>
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={pickImage}
              />
            </div>
          </div>
          <div className="buttons">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save project'}
            </button>
            <button className="btn" type="button" onClick={reset}>
              Cancel
            </button>
          </div>
          {message.text && (
            <p className={`note ${message.type}`} role={message.type === 'err' ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}
        </form>

        <section className="card">
          <h2>Your projects</h2>
          {data.projects.length === 0 ? (
            <p className="empty">No projects yet. Fill in the form to add your first one.</p>
          ) : (
            <ul className="rows">
              {data.projects.map((p) => (
                <li className="row" key={p.id}>
                  <span className="thumb thumb-md">{p.image && <img src={p.image} alt="" />}</span>
                  <div className="row-text">
                    <strong>{p.title}</strong>
                    <span className="mono">{p.tags.join(', ')}</span>
                  </div>
                  <button className="btn btn-sm" type="button" onClick={() => {
                      setMessage({ type: '', text: '' });
                      setParams({ edit: p.id });
                    }}>
                    Edit
                  </button>
                  <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(p)}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
