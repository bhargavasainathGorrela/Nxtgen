// client/src/components/Login.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const PRESET_COLORS = [
  '#fecaca', '#fed7aa', '#fef08a', '#bbf7d0',
  '#a5f3fc', '#bfdbfe', '#ddd6fe', '#fbcfe8',
  '#e5e7eb', '#1f2937', '#0f766e', '#7c3aed',
];

const STORAGE_KEY = 'loginBackground';
const USER_STORAGE_KEY = 'stockwise-user';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // background: { type: 'default' | 'color' | 'image', value: string }
  const [bg, setBg] = useState({ type: 'default', value: '' });
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load saved background on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setBg(JSON.parse(saved));
    } catch {
      /* ignore */
    }
  }, []);

  // Save background whenever it changes
  useEffect(() => {
    try {
      if (bg.type === 'default') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(bg));
    } catch {
      // Large images can exceed storage quota; the background still works for this session
    }
  }, [bg]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ---- Background handlers ----
  const handleBgColor = (color) => setBg({ type: 'color', value: color });

  const handleBgImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image is too large. Please choose one under 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setBg({ type: 'image', value: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  const resetBg = () => setBg({ type: 'default', value: '' });

  // Dynamic values can't be Tailwind classes, so they go in inline style
  const bgStyle =
    bg.type === 'color'
      ? { backgroundColor: bg.value }
      : bg.type === 'image'
      ? {
          backgroundImage: `url(${bg.value})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resp = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json();
      if (data.success) {
        localStorage.setItem(
          USER_STORAGE_KEY,
          data.user?.username || username,
        );
        navigate('/home');
      } else {
        setError(data.message ?? 'Login failed');
      }
    } catch (err) {
      setError('Unable to reach server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={bgStyle}
      className={`relative flex min-h-screen items-center justify-center px-4 transition-colors duration-300 ${
        bg.type === 'default'
          ? 'bg-gradient-to-br from-slate-100 via-gray-100 to-blue-100'
          : ''
      }`}
    >
      {/* ===== Login card ===== */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl ring-1 ring-black/5 transition-all">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-md">
            A
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-800">
            Admin Login
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Sign in to continue to your dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 placeholder-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
            >
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-4.75a.75.75 0 001.5 0v-4.5a.75.75 0 00-1.5 0v4.5zm.75-7a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Signing in…
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Admin Panel
        </p>
      </div>

      {/* ===== Customize (pencil) button + panel ===== */}
      <div ref={panelRef} className="fixed bottom-5 right-5 z-50">
        {panelOpen && (
          <div className="mb-3 w-72 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/10">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                Customize background
              </h3>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Close"
                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Preset colors */}
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
              Colors
            </p>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleBgColor(c)}
                  aria-label={`Use color ${c}`}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-full ring-1 ring-black/10 transition hover:scale-110 ${
                    bg.type === 'color' && bg.value === c
                      ? 'ring-2 ring-blue-600 ring-offset-2'
                      : ''
                  }`}
                />
              ))}
            </div>

            {/* Custom color picker */}
            <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <input
                type="color"
                value={bg.type === 'color' ? bg.value : '#3b82f6'}
                onChange={(e) => handleBgColor(e.target.value)}
                className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
              />
              Custom color
            </label>

            {/* Image upload */}
            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
              Image
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleBgImage}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z" />
                <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
              </svg>
              Upload from device
            </button>

            {/* Reset */}
            {bg.type !== 'default' && (
              <button
                type="button"
                onClick={resetBg}
                className="mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
              >
                Reset to default
              </button>
            )}
          </div>
        )}

        {/* Pencil FAB */}
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          aria-label="Customize background"
          aria-expanded={panelOpen}
          className="ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-700 shadow-lg ring-1 ring-black/10 transition hover:bg-gray-50 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}