import { useEffect, useRef, useState } from 'react';
import { api, checkImage } from '../api';
import { useAdminData, useObjectUrl } from '../hooks';

const empty = { name: '', title: '', bio: '', email: '', github: '', linkedin: '' };

export default function Profile() {
  const { data, error, reload } = useAdminData();
  const [form, setForm] = useState(empty);
  const [photo, setPhoto] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  const preview = useObjectUrl(photo);

  useEffect(() => {
    if (!data) return;
    const { photo: _photo, ...fields } = data.profile;
    setForm({ ...empty, ...fields });
  }, [data]);

  if (error) return <p className="note err">{error}</p>;
  if (!data) return <p className="note">Loading…</p>;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const shownPhoto = preview || data.profile.photo;

  const pickPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const problem = checkImage(file);
    if (problem) {
      setMessage({ type: 'err', text: problem });
      e.target.value = '';
      return;
    }
    setPhoto(file);
    setMessage({ type: '', text: '' });
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage({ type: '', text: '' });
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    if (photo) body.append('photo', photo);
    try {
      await api.saveProfile(body);
      setPhoto(null);
      if (fileInput.current) fileInput.current.value = '';
      await reload();
      setMessage({ type: 'ok', text: 'Saved. Your site is updated.' });
    } catch (err) {
      setMessage({ type: 'err', text: err.message });
    }
    setBusy(false);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Profile and photo</h1>
          <p className="sub">This is the intro visitors see at the top of your site.</p>
        </div>
      </div>

      <div className="grid profile-grid">
        <section className="card">
          <h2>Photo</h2>
          <div className="avatar">
            {shownPhoto ? <img src={shownPhoto} alt="Your profile" /> : <span>{(form.name || 'Y').charAt(0).toUpperCase()}</span>}
          </div>
          <div className="center">
            <button className="btn" type="button" onClick={() => fileInput.current.click()}>
              Upload new photo
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={pickPhoto}
            />
          </div>
          <p className="help center-text">JPG, PNG, WebP or GIF, up to 4 MB. Press Save info to publish it.</p>
        </section>

        <form className="card" onSubmit={save}>
          <h2>Your info</h2>
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={form.name} onChange={set('name')} required maxLength={80} />
            </div>
            <div className="field">
              <label htmlFor="title">Title</label>
              <input id="title" value={form.title} onChange={set('title')} maxLength={80} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              rows={5}
              placeholder="Write a short intro about yourself"
              value={form.bio}
              onChange={set('bio')}
              maxLength={800}
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
          </div>
          <div className="form-grid two">
            <div className="field">
              <label htmlFor="github">GitHub link</label>
              <input id="github" placeholder="https://github.com/" value={form.github} onChange={set('github')} />
            </div>
            <div className="field">
              <label htmlFor="linkedin">LinkedIn link</label>
              <input
                id="linkedin"
                placeholder="https://linkedin.com/in/"
                value={form.linkedin}
                onChange={set('linkedin')}
              />
            </div>
          </div>
          <div className="buttons">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save info'}
            </button>
            <a className="btn" href="/" target="_blank" rel="noopener noreferrer">
              Preview site
            </a>
          </div>
          {message.text && (
            <p className={`note ${message.type}`} role={message.type === 'err' ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}
        </form>
      </div>
    </>
  );
}
