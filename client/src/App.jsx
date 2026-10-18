import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { campusOpportunities, clubs } from './clubs';
import { openClubsPage, openEventsSection } from './homeNavigation';
import { teamSubcategories } from '../../shared/teamCategories.mjs';

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
  } catch {
    throw new Error('CampusLoop could not reach the API. Check that the backend server is running, then try again.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || (response.status >= 500 ? 'CampusLoop server is unavailable. Check the backend terminal and try again.' : 'Something went wrong. Please try again.'));
  return data;
}

const blankEvent = { title: '', description: '', announcement: '', reminderText: '', category: 'Community', club: '', date: '', startTime: '18:00', venue: '', registrationDeadline: '', registrationMode: 'internal', registrationUrl: '', socialUrl: '', posterData: '', posterUrl: '', removePoster: false };
const categories = ['Arts', 'Career', 'Community', 'Food', 'Sports', 'Technology', 'Wellness', 'Other'];
const prettyDate = (date) => new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const localDateTimeValue = (value) => { const date = new Date(value); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16); };
const prettyTime = (time) => { const [hour, minute] = time.split(':'); return new Date(2000, 0, 1, Number(hour), Number(minute)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

function EventCard({ event, onOpen, saved }) {
  return <article className="event-card">
    <button className="event-visual" style={event.posterUrl ? { backgroundImage: `linear-gradient(0deg, #10100fcc, transparent 55%), url("${event.posterUrl}")` } : undefined} onClick={() => onOpen(event)} aria-label={`View ${event.title}`}><span className="category-pill">{event.category}</span><span className="visual-symbol" aria-hidden="true">{event.posterUrl ? '' : event.category === 'Arts' ? '✳' : event.category === 'Sports' ? '↗' : '✦'}</span><span className="visual-club">{event.club}</span></button>
    <div className="event-card-body"><div className="event-meta">{prettyDate(event.date)} <span>·</span> {prettyTime(event.startTime)}</div><button className="text-button event-title" onClick={() => onOpen(event)}>{event.title}</button><div className="event-location">{event.venue}</div><div className="event-card-bottom"><span>By {event.organizer?.name || event.club}</span>{saved && <span className="saved-mark" title="Bookmarked">♥</span>}</div></div>
  </article>;
}

function PosterArtwork({ event, className = '' }) {
  const tone = (event?.category || 'community').toLowerCase().replace(/[^a-z]/g, '');
  if (event?.posterUrl) return <div className={`event-poster-image ${className}`}><img src={event.posterUrl} alt="" /></div>;
  return <div className={`poster-art tone-${tone} ${className}`}>
    <span className="poster-art-label">CAMPUSLOOP · {event?.club || 'CAMPUS EVENTS'}</span>
    <span className="poster-art-orbit" aria-hidden="true">✳</span>
    <span className="poster-art-category">{event?.category || 'UP NEXT'}</span>
    <strong>{event?.title || 'Find your next thing'}</strong>
    <span className="poster-art-date">{event ? prettyDate(event.date).toUpperCase() : 'GOOD THINGS ARE HAPPENING'}</span>
  </div>;
}

function AuthForm({ mode, onSubmit, onMode, onLoginType, busy, error }) {
  const isTeam = mode === 'team-login';
  const isRegister = mode === 'register';
  const loginMode = mode === 'login' || isTeam;
  return <section className="form-panel auth-panel"><p className="eyebrow">{isTeam ? 'TEAM ACCOUNT' : 'STUDENT ACCOUNT'}</p><h1>{isTeam ? 'Team login.' : loginMode ? 'Welcome back.' : 'Find your people.'}</h1><p className="form-intro">{isTeam ? 'Sign in with an administrator-approved team representative account.' : loginMode ? 'Log in to save events and keep your plans in one place.' : 'Create a student account to bookmark events and sign up.'}</p>
    {loginMode && <div className="login-choice" aria-label="Choose account type"><button type="button" className={!isTeam ? 'selected' : ''} onClick={() => onLoginType('login')}>Student Login</button><button type="button" className={isTeam ? 'selected' : ''} onClick={() => onLoginType('team-login')}>Team Login</button></div>}
    <form onSubmit={onSubmit} className="form-grid">
      {isRegister && <label>Your name<input name="name" autoComplete="name" minLength="2" maxLength="80" required /></label>}
      <label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required /></label>
      <label>Password<input name="password" type="password" autoComplete={loginMode ? 'current-password' : 'new-password'} minLength="8" maxLength="128" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button form-submit" disabled={busy}>{busy ? 'Please wait…' : isTeam ? 'Team Login' : loginMode ? 'Student Login' : 'Create student account'} <span aria-hidden="true">→</span></button>
    </form>
    {isTeam ? <><p className="auth-pending">Team account requests are reviewed by a CampusLoop administrator. Submitting a request does not grant team access.</p><button className="primary-button team-request-link" type="button" onClick={() => onMode('team-register')}>Create Team Account <span aria-hidden="true">→</span></button></> : <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to CampusLoop?'} <button className="text-button" onClick={() => onMode(isRegister ? 'login' : 'register')}>{isRegister ? 'Student login' : 'Create a student account'}</button></p>}
  </section>;
}

function TeamRegistrationForm({ onSubmit, onBack, busy, error, submitted }) {
  const [category, setCategory] = useState('Technical');
  const [logoData, setLogoData] = useState('');
  const [fileError, setFileError] = useState('');
  const subcategories = teamSubcategories[`${category} Teams`] || [];
  function selectLogo(file) {
    setFileError(''); setLogoData('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setFileError('Choose a JPG, PNG, or WebP logo.'); return; }
    if (file.size > 2 * 1024 * 1024) { setFileError('Logo must be 2 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoData(String(reader.result));
    reader.onerror = () => setFileError('Could not read this image. Please select it again.');
    reader.readAsDataURL(file);
  }
  return <section className="form-panel auth-panel team-registration-panel">
    <button type="button" className="back-button" onClick={onBack}>← Back to Team Login</button>
    <p className="eyebrow">TEAM ACCOUNT REQUEST</p><h1>Create your team account.</h1>
    {submitted ? <div className="team-request-success" role="status"><span aria-hidden="true">✓</span><h2>Your team account request has been submitted for review.</h2><p>A CampusLoop administrator will review the request. You can use Team Login after approval; no team access is granted yet.</p><button type="button" className="primary-button" onClick={onBack}>Return to Team Login <span aria-hidden="true">→</span></button></div> : <>
      <p className="form-intro">Share the team and representative details for administrator review. NITT email or identity information is collected as provided and is not independently verified.</p>
      <form className="form-grid" onSubmit={(event) => { event.preventDefault(); if (!fileError) { const fields = Object.fromEntries(new FormData(event.currentTarget)); fields.category = category; fields.logoData = logoData; onSubmit(fields); } }}>
        <label>Official team or club name<input name="teamName" required minLength="2" maxLength="100" autoComplete="organization" /></label>
        <div className="form-row"><label>Main category<select value={category} onChange={(event) => setCategory(event.target.value)}><option>Technical</option><option>Cultural</option><option>Sports</option></select></label><label>Subcategory<select name="subcategory" required key={category}>{subcategories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <label>Short description<textarea name="description" required minLength="10" maxLength="1000" rows="3" placeholder="What does your team do?" /></label>
        <label>Official team email<input name="teamEmail" type="email" required maxLength="254" autoComplete="email" /></label>
        <label>Representative’s name<input name="representativeName" required minLength="2" maxLength="80" autoComplete="name" /></label>
        <div className="form-row"><label>Representative’s NITT or institutional email (optional)<input name="representativeEmail" type="email" maxLength="254" placeholder="Not verified by CampusLoop" /></label><label>Other institutional identity details (optional)<input name="representativeIdentity" maxLength="300" placeholder="Details provided for review" /></label></div>
        <div className="form-row"><label>Password<input name="password" type="password" required minLength="8" maxLength="128" autoComplete="new-password" /></label><label>Confirm password<input name="confirmPassword" type="password" required minLength="8" maxLength="128" autoComplete="new-password" /></label></div>
        <div className="form-row"><label>Official website (optional)<input name="websiteUrl" type="url" placeholder="https://…" /></label><label>Official Instagram (optional)<input name="instagramUrl" type="url" placeholder="https://www.instagram.com/…" /></label></div>
        <label>Team logo (optional, JPG/PNG/WebP; max 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectLogo(event.target.files?.[0])} /><small>Uploaded image bytes are stored without image editing. An upload does not verify official affiliation.</small>{logoData && <span className="team-logo-preview"><img src={logoData} alt="Selected team logo preview" /><span>Original image preview</span></span>}{fileError && <span className="form-error" role="alert">{fileError}</span>}</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button form-submit" disabled={busy || Boolean(fileError)}>{busy ? 'Submitting request…' : 'Submit for approval'} <span aria-hidden="true">→</span></button>
      </form>
    </>}
  </section>;
}

function EventForm({ initial = blankEvent, onSave, onCancel, busy }) {
  const [values, setValues] = useState(() => ({ ...blankEvent, ...initial, date: initial.date ? new Date(initial.date).toISOString().slice(0, 10) : '', registrationDeadline: initial.registrationDeadline ? localDateTimeValue(initial.registrationDeadline) : '' }));
  const [posterError, setPosterError] = useState('');
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));
  function choosePoster(file) {
    setPosterError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setPosterError('Choose a JPG, PNG, or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setPosterError('Poster must be 2 MB or smaller.'); return; }
    const reader = new FileReader();
    reader.onload = () => { set('posterData', String(reader.result)); set('removePoster', false); };
    reader.onerror = () => setPosterError('Could not read this image. Please choose it again.');
    reader.readAsDataURL(file);
  }
  return <form className="form-grid event-form" onSubmit={(event) => { event.preventDefault(); if (posterError) return; const payload = { ...values, registrationDeadline: values.registrationDeadline ? new Date(values.registrationDeadline).toISOString() : '' }; if (!values.posterData) delete payload.posterData; onSave(payload); }}>
    <label>Event title<input required minLength="5" maxLength="120" value={values.title} onChange={(e) => set('title', e.target.value)} /></label>
    <div className="form-row"><label>Category<select value={values.category} onChange={(e) => set('category', e.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Club or organizer<input required minLength="2" maxLength="100" value={values.club} onChange={(e) => set('club', e.target.value)} /></label></div>
    <div className="form-row"><label>Date<input type="date" required value={values.date} onChange={(e) => set('date', e.target.value)} /></label><label>Start time<input type="time" required value={values.startTime} onChange={(e) => set('startTime', e.target.value)} /></label></div>
    <label>Venue<input required minLength="2" maxLength="160" value={values.venue} onChange={(e) => set('venue', e.target.value)} /></label>
    <label>Registration deadline (optional)<input type="datetime-local" value={values.registrationDeadline} onChange={(e) => set('registrationDeadline', e.target.value)} /><small>Leave blank to keep registration open until the event starts.</small></label>
    <label>Short event description<textarea required minLength="20" maxLength="4000" rows="3" value={values.description} onChange={(e) => set('description', e.target.value)} /></label>
    <label>Announcement message (optional)<textarea maxLength="4000" rows="5" placeholder="Paste the club announcement here. Line breaks will be kept." value={values.announcement} onChange={(e) => set('announcement', e.target.value)} /></label>
    <label>Reminder message (optional)<textarea maxLength="2000" rows="3" placeholder="Add a follow-up message, such as time, venue, or on-spot registration details." value={values.reminderText} onChange={(e) => set('reminderText', e.target.value)} /><small>This message is shown on the event page; CampusLoop does not send it automatically.</small></label>
    <div className="form-row"><label>Registration method<select value={values.registrationMode} onChange={(e) => { set('registrationMode', e.target.value); if (e.target.value === 'internal') set('registrationUrl', ''); }}><option value="internal">Register in CampusLoop</option><option value="external">Use an external form</option></select></label>{values.registrationMode === 'external' && <label>External registration form URL<input type="url" required placeholder="https://…" value={values.registrationUrl} onChange={(e) => set('registrationUrl', e.target.value)} /></label>}</div>
    {values.registrationMode === 'external' && <small>Students will leave CampusLoop to register. CampusLoop cannot confirm that they submitted the external form.</small>}
    <label>Social post link (optional)<input type="url" placeholder="https://instagram.com/…" value={values.socialUrl} onChange={(e) => set('socialUrl', e.target.value)} /></label>
    <label>Event poster (JPG, PNG, or WebP; max 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => choosePoster(e.target.files?.[0])} />{(values.posterData || values.posterUrl) && !values.removePoster && <span className="poster-preview"><img src={values.posterData || values.posterUrl} alt="Event poster preview" /><button className="secondary-button" type="button" onClick={() => { set('posterData', ''); set('posterUrl', ''); set('removePoster', true); }}>Remove poster</button></span>}{posterError && <span className="form-error" role="alert">{posterError}</span>}</label>
    <div className="form-row"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Publish event'} <span aria-hidden="true">→</span></button><button className="secondary-button" type="button" onClick={onCancel}>Cancel</button></div>
  </form>;
}

function TeamProfileForm({ profile, onSave, busy }) {
  const [values, setValues] = useState(() => ({ ...profile, logoData: '', removeLogo: false }));
  const [fileError, setFileError] = useState('');
  function chooseLogo(file) {
    setFileError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setFileError('Choose a JPG, PNG, or WebP logo.');
    if (file.size > 2 * 1024 * 1024) return setFileError('Logo must be 2 MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => setValues((current) => ({ ...current, logoData: String(reader.result), removeLogo: false }));
    reader.onerror = () => setFileError('Could not read that image. Please choose it again.');
    reader.readAsDataURL(file);
  }
  return <form className="form-panel team-profile-form" onSubmit={(event) => { event.preventDefault(); if (!fileError) onSave(values); }}>
    <h2>Team profile</h2><p className="muted">Your profile is private to this approved team account until an administrator publishes it in the directory.</p>
    <label>Team name<input required minLength="2" maxLength="100" value={values.name || ''} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
    <label>Short description<textarea maxLength="2000" rows="3" value={values.description || ''} onChange={(event) => setValues({ ...values, description: event.target.value })} /></label>
    <div className="form-row"><label>Official website URL<input type="url" placeholder="https://…" value={values.websiteUrl || ''} onChange={(event) => setValues({ ...values, websiteUrl: event.target.value })} /></label><label>Official Instagram profile<input type="url" placeholder="https://www.instagram.com/…" value={values.instagramUrl || ''} onChange={(event) => setValues({ ...values, instagramUrl: event.target.value })} /></label></div>
    <label>Team logo (JPG, PNG, or WebP; max 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseLogo(event.target.files?.[0])} />{(values.logoData || profile.logoUrl) && !values.removeLogo && <span className="team-logo-preview"><img src={values.logoData || profile.logoUrl} alt="Team logo preview" /><button type="button" className="secondary-button" onClick={() => setValues({ ...values, logoData: '', removeLogo: true })}>Remove logo</button></span>}{fileError && <span className="form-error" role="alert">{fileError}</span>}</label>
    <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save team profile'}</button>
  </form>;
}

function AdminReviewPage({ requests, loading, error, notice, busyId, onRefresh, onApprove, onReject }) {
  return <section className="content-page admin-review-page">
    <div className="title-row"><div><p className="eyebrow">CAMPUSLOOP ADMINISTRATION</p><h1 className="page-title">Team account requests</h1><p className="muted">Review the submitted details before granting a representative team access.</p></div><button className="secondary-button" onClick={onRefresh} disabled={loading}>Refresh requests</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
    {loading ? <div className="empty-state" role="status"><p>Loading pending requests…</p></div> : requests.length === 0 ? <div className="empty-state"><span>✓</span><h2>No pending requests</h2><p>New team account requests will appear here after submission.</p></div> : <div className="admin-request-list">{requests.map((request) => <AdminRequestCard key={request.id} request={request} busy={busyId === request.id} onApprove={onApprove} onReject={onReject} />)}</div>}
  </section>;
}

function AdminRequestCard({ request, busy, onApprove, onReject }) {
  const [reason, setReason] = useState('');
  return <article className="admin-request-card">
    <div className="admin-request-heading"><div><span className="eyebrow">{request.category} · {request.subcategory}</span><h2>{request.teamName}</h2><p className="muted">Submitted {new Date(request.createdAt).toLocaleString()}</p></div><span className="status-chip pending_approval">Pending review</span></div>
    <div className="admin-request-content">
      <div className="admin-request-details"><p><strong>Team email:</strong> {request.teamEmail}</p><p><strong>Representative:</strong> {request.representativeName}</p><p><strong>Institutional details (not verified):</strong> {request.representativeIdentity || 'Not provided'}</p><p><strong>Description:</strong> {request.description}</p>
        <div className="admin-request-links">{request.websiteUrl && <a href={request.websiteUrl} target="_blank" rel="noreferrer">Official website ↗</a>}{request.instagramUrl && <a href={request.instagramUrl} target="_blank" rel="noreferrer">Instagram ↗</a>}</div>
      </div>
      {request.hasLogo && <img className="admin-request-logo" src={`/api/admin/team-requests/${encodeURIComponent(request.id)}/logo`} alt={`${request.teamName} submitted logo`} />}
    </div>
    <div className="admin-request-actions"><button className="primary-button" onClick={() => onApprove(request.id)} disabled={busy}>{busy ? 'Saving…' : 'Approve request'}</button><form onSubmit={(event) => { event.preventDefault(); onReject(request.id, reason); }}><label className="sr-only" htmlFor={`reject-reason-${request.id}`}>Optional rejection reason</label><input id={`reject-reason-${request.id}`} value={reason} maxLength="500" onChange={(event) => setReason(event.target.value)} placeholder="Optional reason for rejection" /><button className="danger-button" disabled={busy}>{busy ? 'Saving…' : 'Reject'}</button></form></div>
  </article>;
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [teamBookmarks, setTeamBookmarks] = useState([]);
  const [page, setPage] = useState('home');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState({ search: '', category: '', club: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [teamRequestSubmitted, setTeamRequestSubmitted] = useState(false);
  const [organizerEvents, setOrganizerEvents] = useState([]);
  const [teamProfile, setTeamProfile] = useState(null);
  const [adminRequests, setAdminRequests] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminNotice, setAdminNotice] = useState('');
  const [adminBusyId, setAdminBusyId] = useState('');
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [attendees, setAttendees] = useState([]);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [clubSearch, setClubSearch] = useState('');
  const [teamMainCategory, setTeamMainCategory] = useState('All');
  const [teamSubcategory, setTeamSubcategory] = useState('');
  const searchInput = useRef(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
      const result = await api(`/events?${params}`);
      setEvents(result.events);
      setError('');
    } catch (issue) { setError(issue.message); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { api('/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null)); }, []);
  useEffect(() => {
    if (page !== 'admin') return undefined;
    if (!user?.isAdmin) { setPage('home'); setAdminError('Administrator access is required to review requests.'); return undefined; }
    let current = true;
    setAdminLoading(true); setAdminError('');
    api('/admin/team-requests').then((result) => { if (current) setAdminRequests(result.requests); })
      .catch((issue) => { if (current) setAdminError(issue.message); })
      .finally(() => { if (current) setAdminLoading(false); });
    return () => { current = false; };
  }, [page, user?.isAdmin]);

  const refreshStudentData = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    const [saved, signedUp, savedTeams] = await Promise.all([api('/bookmarks'), api('/registrations'), api('/team-bookmarks')]);
    setBookmarks(saved.bookmarks.map((item) => item.event));
    setRegistrations(signedUp.registrations);
    setTeamBookmarks(savedTeams.bookmarks);
  }, [user]);
  useEffect(() => { refreshStudentData().catch((issue) => setError(issue.message)); }, [refreshStudentData]);

  const savedIds = useMemo(() => new Set(bookmarks.map((event) => event?._id)), [bookmarks]);
  const savedTeamNames = useMemo(() => new Set(teamBookmarks.map((item) => item.teamName)), [teamBookmarks]);
  const featuredEvent = events.length ? events[featuredIndex % events.length] : null;
  const focusSearch = () => { if (page !== 'home') go('home'); window.setTimeout(() => searchInput.current?.focus(), 50); };
  const visibleClubs = clubs.filter((club) => {
    const matchesSearch = `${club.name} ${club.category} ${club.focus}`.toLowerCase().includes(clubSearch.toLowerCase().trim());
    return matchesSearch && (teamMainCategory === 'All' || club.mainCategory === teamMainCategory) && (!teamSubcategory || club.category === teamSubcategory);
  });
  const availableSubcategories = teamMainCategory === 'All'
    ? [...new Set(Object.values(teamSubcategories).flat())].sort()
    : teamSubcategories[teamMainCategory] || [];
  const go = (nextPage) => { setError(''); setNotice(''); setSelectedEvent(null); setPage(nextPage); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const requireLogin = () => { setAuthMode('login'); go('auth'); };
  const detail = async (event) => {
    setSelectedEvent(event);
    setPage('detail');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try { setSelectedEvent((await api(`/events/${event._id}`)).event); }
    catch (issue) { setError(issue.message); }
  };

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const endpoint = authMode === 'team-login' ? 'team-login' : authMode === 'login' ? 'login' : 'register';
      const result = await api(`/auth/${endpoint}`, { method: 'POST', body: JSON.stringify(fields) });
      setUser(result.user);
      if (result.user.isAdmin) go('admin');
      else if (result.user.role === 'organizer') {
        go('organizer');
        const [managed, profile] = await Promise.all([api('/events/managed'), api('/team/profile')]);
        setOrganizerEvents(managed.events); setTeamProfile(profile.profile);
      } else go('home');
      setNotice(`Welcome back, ${result.user.name.split(' ')[0]}!`);
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function submitTeamRequest(fields) {
    setBusy(true); setError(''); setTeamRequestSubmitted(false);
    try {
      await api('/auth/team-register', { method: 'POST', body: JSON.stringify(fields) });
      setTeamRequestSubmitted(true);
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function refreshAdminRequests() {
    setAdminLoading(true); setAdminError('');
    try { setAdminRequests((await api('/admin/team-requests')).requests); }
    catch (issue) { setAdminError(issue.message); }
    finally { setAdminLoading(false); }
  }

  async function reviewTeamRequest(requestId, decision, reason = '') {
    setAdminBusyId(requestId); setAdminError(''); setAdminNotice('');
    try {
      const suffix = decision === 'approve' ? 'approve' : 'reject';
      const result = await api(`/admin/team-requests/${encodeURIComponent(requestId)}/${suffix}`, { method: 'POST', body: JSON.stringify({ reason }) });
      setAdminNotice(result.message); setAdminRequests((current) => current.filter((item) => item.id !== requestId));
    } catch (issue) { setAdminError(issue.message); }
    finally { setAdminBusyId(''); }
  }

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); setBookmarks([]); setRegistrations([]); setTeamBookmarks([]); setNotice('You are logged out.'); go('home'); }
    catch (issue) { setError(issue.message); }
  }

  async function toggleBookmark(event) {
    if (!user) return requireLogin();
    setBusy(true); setError('');
    try {
      if (savedIds.has(event._id)) { await api(`/bookmarks/${event._id}`, { method: 'DELETE' }); setBookmarks((items) => items.filter((item) => item._id !== event._id)); setNotice('Removed from your saved events.'); }
      else { await api(`/bookmarks/${event._id}`, { method: 'POST' }); setBookmarks((items) => [...items, event]); setNotice('Event saved to your bookmarks.'); }
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function toggleTeamBookmark(team) {
    if (!user) return requireLogin();
    if (user.role !== 'student') { setError('Only student accounts can save teams.'); return; }
    setBusy(true); setError('');
    try {
      if (savedTeamNames.has(team.name)) {
        await api(`/team-bookmarks/${encodeURIComponent(team.name)}`, { method: 'DELETE' });
        setTeamBookmarks((items) => items.filter((item) => item.teamName !== team.name));
        setNotice('Team removed from your saved list.');
      } else {
        await api('/team-bookmarks', { method: 'POST', body: JSON.stringify({ teamName: team.name }) });
        setTeamBookmarks((items) => [...items, { teamName: team.name }]);
        setNotice('Team saved to your list.');
      }
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function registerEvent(event) {
    if (!user) return requireLogin();
    setBusy(true); setError('');
    try { await api(`/registrations/${event._id}`, { method: 'POST' }); setNotice('You’re registered. See you there!'); await refreshStudentData(); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function showStudentDashboard() {
    if (!user) { requireLogin(); return; }
    if (user.role !== 'student') { setError('Use the team dashboard for an approved team account.'); return; }
    go('student');
    try { await refreshStudentData(); } catch (issue) { setError(issue.message); }
  }

  async function showOrganizerDashboard() {
    go('organizer');
    if (!user) { requireLogin(); return; }
    if (user.role !== 'organizer') { setError('Only authorized organizers can access event management.'); return; }
    try {
      const [managed, profile] = await Promise.all([api('/events/managed'), api('/team/profile')]);
      setOrganizerEvents(managed.events); setTeamProfile(profile.profile);
    } catch (issue) { setError(issue.message); }
  }

  async function saveTeamProfile(values) {
    setBusy(true); setError('');
    try { const result = await api('/team/profile', { method: 'PUT', body: JSON.stringify(values) }); setTeamProfile(result.profile); setNotice('Team profile saved.'); }
    catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function saveEvent(values) {
    setBusy(true); setError('');
    try {
      const result = await api(editingEvent ? `/events/${editingEvent._id}` : '/events', { method: editingEvent ? 'PUT' : 'POST', body: JSON.stringify(values) });
      setNotice(editingEvent ? 'Event updated.' : 'Event published.'); setEventFormOpen(false); setEditingEvent(null); setOrganizerEvents((await api('/events/managed')).events); await loadEvents();
    } catch (issue) { setError(issue.message); }
    finally { setBusy(false); }
  }

  async function cancelEvent(event) {
    if (!window.confirm(`Cancel “${event.title}”? Students will no longer see it in the public feed.`)) return;
    try { await api(`/events/${event._id}`, { method: 'DELETE' }); setNotice('Event cancelled.'); setOrganizerEvents((await api('/events/managed')).events); await loadEvents(); }
    catch (issue) { setError(issue.message); }
  }

  async function showAttendees(event) {
    try { setAttendees((await api(`/events/${event._id}/registrations`)).registrations); setSelectedEvent(event); setPage('attendees'); }
    catch (issue) { setError(issue.message); }
  }

  const isRegistered = (eventId) => registrations.some((item) => item.event?._id === eventId && item.status === 'registered');

  return <main className="page-shell">
    <header className="topbar">
      <button className="brand text-button" onClick={() => go('home')} aria-label="CampusLoop home"><span className="brand-mark">C</span> campusloop</button>
      <nav aria-label="Main navigation"><button onClick={() => go('home')}>Explore events</button><button onClick={() => go('clubs')}>NITT teams</button>{user ? <>{user.role === 'student' && <button onClick={showStudentDashboard}>My events</button>}{user.role === 'organizer' && <button onClick={showOrganizerDashboard}>Team dashboard</button>}{user.isAdmin && <button className="nav-login" onClick={() => go('admin')}>Admin review</button>}<span className="nav-user">Hi, {user.name.split(' ')[0]}</span><button className="nav-login" onClick={logout}>Log out</button></> : <><button className="nav-login" onClick={() => { setAuthMode('login'); go('auth'); }}>Student Login</button><button className="nav-login" onClick={() => { setAuthMode('team-login'); go('auth'); }}>Team Login</button></>}</nav>
    </header>

    {page === 'home' && <>
      <section className="home-hero" aria-labelledby="home-hero-title">
        <p className="home-hero-eyebrow">NITT CAMPUS EVENTS &amp; COMMUNITIES</p>
        <h1 id="home-hero-title">Every Team Has a Place. Every Student Has a Way In.</h1>
        <p className="home-hero-copy">Bringing clubs, students, and campus events closer together.</p>
        <div className="home-hero-actions">
          <button className="primary-button" onClick={openEventsSection}>Explore Events <span aria-hidden="true">↓</span></button>
          <button className="secondary-button hero-secondary-button" onClick={() => openClubsPage(go)}>Explore Clubs <span aria-hidden="true">↗</span></button>
        </div>
      </section>
      <section className="mobile-feature" id="home" aria-label="Featured campus event">
        <div className="feature-poster-wrap">
          {loading ? <div className="feature-loading">Finding what’s happening…</div> : <button className="feature-poster-button" onClick={() => featuredEvent && detail(featuredEvent)} aria-label={featuredEvent ? `View featured event ${featuredEvent.title}` : 'No featured event yet'}><PosterArtwork event={featuredEvent} className="feature-art" /></button>}
          {events.length > 1 && <><button className="carousel-arrow previous" aria-label="Previous featured event" onClick={() => setFeaturedIndex((i) => (i - 1 + events.length) % events.length)}>‹</button><button className="carousel-arrow next" aria-label="Next featured event" onClick={() => setFeaturedIndex((i) => (i + 1) % events.length)}>›</button></>}
          {events.length > 1 && <div className="feature-dots" aria-label={`Event ${featuredIndex % events.length + 1} of ${events.length}`}>{events.slice(0, Math.min(events.length, 8)).map((event, index) => <button key={event._id} className={index === featuredIndex % events.length ? 'active' : ''} aria-label={`Show ${event.title}`} onClick={() => setFeaturedIndex(index)} />)}</div>}
        </div>
        <div className="feature-caption">{featuredEvent ? <><p className="feature-kicker">{featuredEvent.club} <span>·</span> {featuredEvent.category}</p><button className="feature-title" onClick={() => detail(featuredEvent)}>{featuredEvent.title}</button><div className="feature-meta"><span>⌖ &nbsp;{featuredEvent.venue}</span><span>▣ &nbsp;{prettyDate(featuredEvent.date)} · {prettyTime(featuredEvent.startTime)}</span></div><div className="feature-actions"><button className="primary-button" onClick={() => detail(featuredEvent)}>Event details <span aria-hidden="true">→</span></button><button className="bookmark-button" aria-label={savedIds.has(featuredEvent._id) ? 'Remove bookmark' : 'Bookmark event'} onClick={() => toggleBookmark(featuredEvent)}>{savedIds.has(featuredEvent._id) ? '♥' : '♡'}</button></div></> : <><p className="feature-kicker">YOUR CAMPUS, IN THE LOOP</p><h2 className="feature-title">Find your next thing.</h2><p className="feature-meta">{loading ? 'Loading upcoming events…' : 'Campus events, all in one place.'}</p></>}</div>
      </section>
      {notice && <p className="notice" role="status">{notice}</p>}{error && <p className="form-error page-error" role="alert">{error}</p>}
      <div className="dashed-divider" aria-hidden="true"><span /></div>
      <section className="explore-section" id="events"><div className="explore-heading"><div><p className="eyebrow">ON YOUR CAMPUS</p><h2>Explore today</h2></div><button className="filter-toggle" onClick={focusSearch}>⌕ <span>Search</span></button></div>
        <div className="search-panel"><label className="search-field"><span aria-hidden="true">⌕</span><input ref={searchInput} aria-label="Search events by title" placeholder="Search events by title" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><label><span className="sr-only">Category</span><select aria-label="Filter by category" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label><span className="sr-only">Club</span><input aria-label="Filter by club" placeholder="Filter by club" value={filters.club} onChange={(e) => setFilters({ ...filters, club: e.target.value })} /></label></div>
        <div className="explore-strip" aria-live="polite">{loading ? <p className="state-message">Loading campus events…</p> : events.length ? events.map((event) => <article className="explore-card" key={event._id}><button className="explore-poster-button" onClick={() => detail(event)} aria-label={`View ${event.title}`}><PosterArtwork event={event} className="explore-art" /></button><button className="explore-card-title" onClick={() => detail(event)}>{event.title}</button><p>{event.club}</p><span>{prettyDate(event.date)}</span></article>) : <div className="empty-state"><span>✳</span><h3>No events to show yet</h3><p>{error ? 'The event list will appear once the server and database are available.' : 'Try a different search, or check back soon for new campus plans.'}</p></div>}</div>
      </section>
    </>}

    {page === 'clubs' && <section className="content-page clubs-page">
      <p className="eyebrow">NIT TIRUCHIRAPPALLI</p>
      <div className="clubs-heading"><div><h1 className="page-title">NIT Trichy Teams</h1><p className="muted">Discover student teams, clubs and groups across campus.</p></div><label className="club-search"><span aria-hidden="true">⌕</span><input aria-label="Search teams" placeholder="Search teams…" value={clubSearch} onChange={(event) => setClubSearch(event.target.value)} /></label></div>
      <div className="team-filter-row"><div className="team-category-tabs" role="tablist" aria-label="Team category">{[['All', 'All'], ['Technical Teams', 'Technical'], ['Cultural Teams', 'Cultural'], ['Sports Teams', 'Sports']].map(([value, label]) => <button key={value} role="tab" aria-selected={teamMainCategory === value} className={teamMainCategory === value ? 'selected' : ''} onClick={() => { setTeamMainCategory(value); setTeamSubcategory(''); }}>{label}</button>)}</div><label className="team-subcategory-filter"><span className="sr-only">Filter by subcategory</span><select aria-label="Filter by subcategory" value={teamSubcategory} onChange={(event) => setTeamSubcategory(event.target.value)}><option value="">All Subcategories</option>{availableSubcategories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <div className="club-results-heading"><h2>{teamMainCategory === 'All' ? 'NITT teams & clubs' : teamMainCategory} <span>{visibleClubs.length}</span></h2><a href="https://www.nitt.edu/home/students/clubsnassocs/" target="_blank" rel="noreferrer">Official NITT directory ↗</a></div>
      {visibleClubs.length ? <div className="club-grid">{visibleClubs.map((club, index) => <article className={`club-card club-tone-${index % 5}`} key={club.name}><div className={`club-card-art ${club.logo ? 'club-logo-container' : 'logo-placeholder'}`}>{club.logo ? <><img src={club.logo} alt={`${club.name} logo supplied by user; official verification pending`} /><small>Provided image · verification pending</small></> : <><span aria-hidden="true">◈</span><small>Logo pending verification</small></>}</div><div className="club-card-body"><span className="club-category">{club.category}</span><h3>{club.name}</h3><p>{club.focus}</p><div className="club-links"><a href={club.website} target="_blank" rel="noreferrer">Official info ↗</a><button className="secondary-button explore-team" onClick={() => window.open(club.website, '_blank', 'noopener,noreferrer')}>Explore team ↗</button></div><button className="team-save-button" disabled={busy} onClick={() => toggleTeamBookmark(club)}>{savedTeamNames.has(club.name) ? '♥ Saved team' : '♡ Save team'}</button><div className="club-reminder"><span aria-hidden="true">◷</span><span><strong>Induction reminders</strong><small>{club.reminders?.length ? club.reminders.join(' · ') : 'We’ll add dates and reminders when the club shares them.'}</small></span></div></div></article>)}</div> : <div className="empty-state"><h3>No matching teams</h3><p>Try a different name or clear the subcategory filter.</p></div>}
      <div className="opportunity-section"><p className="eyebrow">CAMPUS-WIDE OPPORTUNITIES</p><h2>More ways to build things</h2><div className="opportunity-grid">{campusOpportunities.map((opportunity) => <article className="opportunity-card" key={opportunity.name}><span>{opportunity.kind}</span><h3>{opportunity.name}</h3><p>{opportunity.focus}</p><a href={opportunity.website} target="_blank" rel="noreferrer">Official info ↗</a></article>)}</div></div>
    </section>}

    {page === 'detail' && selectedEvent && <section className="content-page">
      <button className="back-button" onClick={() => go('home')}>← Back to events</button>
      <article className="detail-card">
        {selectedEvent.posterUrl ? <img className="detail-poster" src={selectedEvent.posterUrl} alt={`Poster for ${selectedEvent.title}`} /> : <div className="detail-banner"><span className="category-pill">{selectedEvent.category}</span><span aria-hidden="true">✳</span></div>}
        <div className="detail-body">
          <p className="eyebrow">{selectedEvent.club}</p><h1>{selectedEvent.title}</h1>
          {selectedEvent.announcement && <p className="detail-announcement">{selectedEvent.announcement}</p>}
          <p className="detail-description">{selectedEvent.description}</p>
          {selectedEvent.reminderText && <aside className="detail-reminder"><strong>Organizer reminder</strong><p>{selectedEvent.reminderText}</p></aside>}
          <div className="detail-facts">
            <div><span>DATE &amp; TIME</span><strong>{prettyDate(selectedEvent.date)} · {prettyTime(selectedEvent.startTime)}</strong></div>
            <div><span>VENUE</span><strong>{selectedEvent.venue}</strong></div>
            <div><span>REGISTER BY</span><strong>{selectedEvent.registrationDeadline ? new Date(selectedEvent.registrationDeadline).toLocaleString() : `Until ${prettyTime(selectedEvent.startTime)} on event day`}</strong></div>
            <div><span>ORGANIZER</span><strong>{selectedEvent.organizer?.name || selectedEvent.club}</strong></div>
          </div>
          {selectedEvent.registrationMode === 'external' && <aside className="external-registration-note"><strong>External registration</strong><p>Registration happens on the organizer’s site. CampusLoop cannot confirm that you submitted the form.</p></aside>}
          {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
          <div className="detail-actions">
            {selectedEvent.registrationMode === 'external'
              ? selectedEvent.registrationUrl ? <a className="primary-button" href={selectedEvent.registrationUrl} target="_blank" rel="noreferrer">Open external registration form <span aria-hidden="true">↗</span></a> : <p className="form-error" role="alert">The organizer has not added an external registration link yet.</p>
              : <button className="primary-button" disabled={busy || isRegistered(selectedEvent._id)} onClick={() => registerEvent(selectedEvent)}>{isRegistered(selectedEvent._id) ? 'Registered in CampusLoop' : busy ? 'Please wait…' : 'Register in CampusLoop'} <span aria-hidden="true">→</span></button>}
            <button className="secondary-button" disabled={busy} onClick={() => toggleBookmark(selectedEvent)}>{savedIds.has(selectedEvent._id) ? '♥ Saved' : '♡ Save event'}</button>
          </div>
          {selectedEvent.socialUrl && <div className="event-external-links"><a className="secondary-button" href={selectedEvent.socialUrl} target="_blank" rel="noreferrer">View original post ↗</a></div>}
        </div>
      </article>
    </section>}

    {page === 'auth' && <section className="content-page"><AuthForm mode={authMode} onSubmit={submitAuth} onMode={(mode) => { if (mode === 'team-register') { setError(''); setTeamRequestSubmitted(false); go('team-register'); } else setAuthMode(mode); }} onLoginType={setAuthMode} busy={busy} error={error} /></section>}
    {page === 'team-register' && <section className="content-page"><TeamRegistrationForm onSubmit={submitTeamRequest} onBack={() => { setAuthMode('team-login'); setTeamRequestSubmitted(false); go('auth'); }} busy={busy} error={error} submitted={teamRequestSubmitted} /></section>}

    {page === 'admin' && <AdminReviewPage requests={adminRequests} loading={adminLoading} error={adminError} notice={adminNotice} busyId={adminBusyId} onRefresh={refreshAdminRequests} onApprove={(id) => reviewTeamRequest(id, 'approve')} onReject={(id, reason) => reviewTeamRequest(id, 'reject', reason)} />}

    {page === 'student' && <section className="content-page"><p className="eyebrow">YOUR CAMPUS PLANS</p><h1 className="page-title">My events</h1><div className="dashboard-grid"><section><h2>Registered events <span>{registrations.filter((item) => item.event).length}</span></h2>{registrations.length ? <div className="dashboard-list">{registrations.filter((item) => item.event).map((item) => <div className="dashboard-item" key={item._id}><div><strong>{item.event.title}</strong><p>{prettyDate(item.event.date)} · {item.event.venue}</p></div><span className={`status-chip ${item.status}`}>{item.status}</span></div>)}</div> : <p className="muted">No registrations yet. Explore events to find something you like.</p>}</section><section><h2>Saved events <span>{bookmarks.length}</span></h2>{bookmarks.length ? <div className="dashboard-list">{bookmarks.map((event) => <div className="dashboard-item" key={event._id}><button className="text-button" onClick={() => detail(event)}><strong>{event.title}</strong><p>{prettyDate(event.date)} · {event.venue}</p></button><button className="remove-button" onClick={() => toggleBookmark(event)} aria-label={`Remove ${event.title} from saved events`}>Remove</button></div>)}</div> : <p className="muted">Nothing saved yet. Bookmark an event to keep it handy.</p>}</section></div><section className="saved-teams"><h2>Saved teams <span>{teamBookmarks.length}</span></h2>{teamBookmarks.length ? <div className="dashboard-list">{teamBookmarks.map((item) => <div className="dashboard-item" key={item.teamName}><strong>{item.teamName}</strong><button className="remove-button" onClick={() => toggleTeamBookmark({ name: item.teamName })}>Remove</button></div>)}</div> : <p className="muted">Save a team from the directory to keep it here.</p>}</section></section>}

    {page === 'organizer' && <section className="content-page"><p className="eyebrow">APPROVED TEAM SPACE</p><div className="title-row"><div><h1 className="page-title">Team dashboard</h1><p className="muted">Update your team profile and manage events owned by this approved account.</p></div><button className="primary-button" onClick={() => { setEditingEvent(null); setEventFormOpen(true); }}>Create an event <span aria-hidden="true">+</span></button></div>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}{teamProfile && <TeamProfileForm key={teamProfile.updatedAt} profile={teamProfile} onSave={saveTeamProfile} busy={busy} />}{!teamProfile && !error && <p className="auth-pending">Your team profile has not been provisioned. A CampusLoop administrator must approve this account.</p>}{eventFormOpen && <div className="form-panel wide-form"><h2>{editingEvent ? 'Edit event' : 'New event'}</h2><EventForm key={editingEvent?._id || 'new'} initial={editingEvent || blankEvent} onSave={saveEvent} onCancel={() => { setEventFormOpen(false); setEditingEvent(null); }} busy={busy} />{error && <p className="form-error" role="alert">{error}</p>}</div>}{organizerEvents.length ? <div className="managed-list">{organizerEvents.map((event) => <article className="managed-item" key={event._id}><div><span className={`status-chip ${event.publicationStatus}`}>{event.publicationStatus}</span><h3>{event.title}</h3><p>{prettyDate(event.date)} · {event.venue} · {event.club}</p></div><div className="managed-actions"><button className="secondary-button" onClick={() => { setEditingEvent(event); setEventFormOpen(true); }}>Edit</button><button className="secondary-button" onClick={() => showAttendees(event)}>Registrations</button>{event.publicationStatus !== 'cancelled' && <button className="danger-button" onClick={() => cancelEvent(event)}>Cancel event</button>}</div></article>)}</div> : !eventFormOpen && <div className="empty-state"><span>✳</span><h3>No events yet</h3><p>Create your first listing and bring the campus together.</p></div>}</section>}

    {page === 'attendees' && <section className="content-page"><button className="back-button" onClick={showOrganizerDashboard}>← Back to your events</button><p className="eyebrow">REGISTRATION LIST</p><h1 className="page-title">{selectedEvent?.title}</h1>{attendees.length ? <div className="attendee-list">{attendees.map((item) => <div className="dashboard-item" key={item._id}><div><strong>{item.student.name}</strong><p>{item.student.email}</p></div><span className="muted">{new Date(item.registeredAt).toLocaleDateString()}</span></div>)}</div> : <div className="empty-state"><span>✳</span><h3>No registrations yet</h3><p>Student registrations will appear here.</p></div>}</section>}

    <footer><button className="brand small text-button" onClick={() => go('home')}><span className="brand-mark">C</span> campusloop</button><span className="server-status"><span className="status-dot" /> Built to bring campus together</span></footer>
    <nav className="mobile-bottom-nav" aria-label="Quick navigation"><button className={page === 'home' ? 'active' : ''} onClick={() => go('home')}><span aria-hidden="true">⌂</span>Home</button><button className={page === 'clubs' ? 'active' : ''} onClick={() => go('clubs')}><span aria-hidden="true">✳</span>Clubs</button><button onClick={focusSearch}><span aria-hidden="true">⌕</span>Search</button><button className={page === 'student' ? 'active' : ''} onClick={showStudentDashboard}><span aria-hidden="true">♡</span>My plans</button>{user?.isAdmin ? <button className={page === 'admin' ? 'active' : ''} onClick={() => go('admin')}><span aria-hidden="true">✓</span>Review</button> : user?.role === 'organizer' ? <button className={page === 'organizer' ? 'active' : ''} onClick={showOrganizerDashboard}><span aria-hidden="true">＋</span>Organize</button> : <button className={page === 'auth' ? 'active' : ''} onClick={user ? logout : requireLogin}><span aria-hidden="true">◉</span>{user ? 'Log out' : 'Account'}</button>}</nav>
  </main>;
}


