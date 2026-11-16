import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import {
  supabase,
  loadLimits,
  loadDay,
  saveLimits,
  saveDay,
  syncWithCloud,
  clearLocalData,
} from './sync.js'

// Calories per 100 g of each food group
const CALORIES_PER_100G = {
  fats: 900,
  carbohydrates: 400,
  meat: 200,
  cheese: 110,
  sourMilk: 60,
  vegetables: 30,
  nuts: 600,
  fruits: 50,
  sweets: 400,
}

const LABELS = {
  calories: 'Calories',
  fats: 'Fats',
  carbohydrates: 'Carbohydrates',
  meat: 'Meat',
  cheese: 'Cheese 5%',
  sourMilk: 'Sour Milk',
  vegetables: 'Vegetables',
  nuts: 'Nuts',
  fruits: 'Fruits',
  sweets: 'Sweets',
}

const ICONS = {
  calories: '🔥',
  vegetables: '🥦',
  meat: '🥩',
  carbohydrates: '🍞',
  cheese: '🧀',
  fats: '🧈',
  sourMilk: '🥛',
  fruits: '🍎',
  nuts: '🥜',
  sweets: '🍫',
}

const DEFAULT_LIMITS = {
  calories: 2000,
  vegetables: 400,
  meat: 150,
  carbohydrates: 250,
  cheese: 50,
  fats: 70,
  sourMilk: 200,
  fruits: 300,
  nuts: 30,
  sweets: 50,
}

const EMPTY_CONSUMED = {
  vegetables: 0,
  meat: 0,
  carbohydrates: 0,
  cheese: 0,
  fats: 0,
  sourMilk: 0,
  fruits: 0,
  nuts: 0,
  sweets: 0,
}

const BAR_COLORS = {
  fats: 'bg-yellow-500',
  carbohydrates: 'bg-orange-500',
  meat: 'bg-red-500',
  cheese: 'bg-amber-500',
  sourMilk: 'bg-blue-400',
  vegetables: 'bg-green-500',
  nuts: 'bg-amber-700',
  fruits: 'bg-pink-500',
  sweets: 'bg-purple-500',
}

// ---------- calculations ----------

function totalCalories(consumed) {
  let total = 0
  Object.keys(consumed).forEach((key) => {
    total += ((consumed[key] || 0) * CALORIES_PER_100G[key]) / 100
  })
  return Math.round(total)
}

function remaining(limit, consumed) {
  return Math.max(0, limit - consumed)
}

function percent(limit, consumed) {
  if (limit === 0) return 0
  return Math.min(100, Math.round((consumed / limit) * 100))
}

// Local calendar date (not UTC), e.g. "2026-11-16"
function todayKey() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ---------- components ----------

function NutrientCard({ label, icon, limit, consumed, unit, displayMode, onChange, color }) {
  const pct = percent(limit, consumed)
  const left = remaining(limit, consumed)

  const handleSlider = (e) => {
    onChange(parseFloat(e.target.value))
  }

  const handleInput = (e) => {
    const value = parseFloat(e.target.value) || 0
    onChange(Math.min(value, limit * 2))
  }

  const shown = displayMode === 'percentage' ? pct : consumed
  const shownLeft = displayMode === 'percentage' ? 100 - pct : left
  const shownUnit = displayMode === 'percentage' ? '%' : unit

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <span className="text-2xl leading-none" aria-hidden="true">
            {icon}
          </span>
          {label}
        </h3>
        <span className="text-sm text-gray-600">
          Remaining:{' '}
          <span className="font-medium">
            {shownLeft.toFixed(0)} {shownUnit}
          </span>
        </span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>

      <input
        type="range"
        min="0"
        max={limit}
        step="1"
        value={consumed}
        onChange={handleSlider}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
      />

      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Consumed:</label>
        <input
          type="number"
          min="0"
          step="1"
          value={consumed}
          onChange={handleInput}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-600 w-12">{unit}</span>
      </div>

      <div className="text-right text-sm text-gray-500">
        {shown.toFixed(0)} {shownUnit} of{' '}
        {displayMode === 'percentage' ? '100%' : `${limit} ${unit}`}
      </div>
    </div>
  )
}

function Dashboard({ limits, consumed, displayMode, onChangeDisplayMode, onUpdateConsumed, onClear }) {
  const calories = totalCalories(consumed)
  const caloriesPct = percent(limits.calories, calories)
  const caloriesLeft = remaining(limits.calories, calories)

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-6 text-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Today's Nutrition</h2>
          <div className="flex gap-3">
            <button
              onClick={onClear}
              className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors"
            >
              Clear
            </button>
            <div role="radiogroup" aria-label="Show amounts in" className="flex bg-white/20 rounded-lg p-1">
              {[
                ['grams', 'Grams'],
                ['percentage', '%'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  role="radio"
                  aria-checked={displayMode === mode}
                  onClick={() => onChangeDisplayMode(mode)}
                  className={`px-4 py-1.5 rounded-md font-medium transition-colors ${
                    displayMode === mode ? 'bg-white text-blue-700 shadow' : 'text-white hover:bg-white/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-xl font-semibold">Total Calories</h3>
            <span className="text-lg">
              Remaining: <span className="font-bold">{caloriesLeft} kcal</span>
            </span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-6 overflow-hidden mb-2">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${Math.min(caloriesPct, 100)}%` }}
            />
          </div>
          <div className="text-right text-sm">
            {calories} kcal of {limits.calories} kcal ({caloriesPct}%)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.keys(EMPTY_CONSUMED).map((key) => (
          <NutrientCard
            key={key}
            label={LABELS[key]}
            icon={ICONS[key]}
            limit={limits[key] ?? DEFAULT_LIMITS[key]}
            consumed={consumed[key] || 0}
            unit="g"
            displayMode={displayMode}
            onChange={(value) => onUpdateConsumed(key, value)}
            color={BAR_COLORS[key]}
          />
        ))}
      </div>
    </div>
  )
}

function PreferencesModal({ limits, onSave, onClose }) {
  const [draft, setDraft] = useState(limits)

  const handleChange = (key, value) => {
    const number = parseFloat(value) || 0
    setDraft((prev) => ({ ...prev, [key]: number }))
  }

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <h2 className="shrink-0 px-6 pt-6 pb-4 text-2xl font-bold text-gray-800 border-b border-gray-200">
          Daily Nutrition Preferences
        </h2>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 space-y-4">
          {Object.keys(DEFAULT_LIMITS).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-gray-700 font-medium w-48 flex items-center gap-2">
                <span className="text-xl leading-none" aria-hidden="true">
                  {ICONS[key]}
                </span>
                {LABELS[key]}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step={key === 'calories' ? '10' : '1'}
                  value={draft[key] ?? DEFAULT_LIMITS[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-600 w-16">{key === 'calories' ? 'kcal' : 'g'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-gray-200 bg-white">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save Preferences
          </button>
        </div>
      </div>
    </div>
  )
}

function SignInModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setStatus('error')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-2 text-gray-800">Sign in</h2>
        <p className="text-gray-600 mb-6">
          Your limits and history will be saved to your account and appear on any device you sign in on.
        </p>

        {status === 'sent' ? (
          <div className="space-y-6">
            <p className="text-gray-800">
              We sent a sign-in link to <span className="font-semibold">{email}</span>. Open it on this
              device to finish signing in.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-gray-700 font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {status === 'error' && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              >
                {status === 'sending' ? 'Sending…' : 'Send sign-in link'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function UserIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  )
}

const SYNC_DOT = {
  idle: 'bg-gray-300',
  syncing: 'bg-amber-400',
  synced: 'bg-green-500',
  error: 'bg-red-500',
}

function UserMenu({ session, syncStatus, onSignIn, onSignOut, onSyncNow }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!supabase) return null

  const email = session?.user?.email
  const initial = email ? email[0].toUpperCase() : null
  const run = (action) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={email ? `Account: ${email}` : 'Account'}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          email ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {initial || <UserIcon className="w-6 h-6" />}
        {email && (
          <span
            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${SYNC_DOT[syncStatus]}`}
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-40 overflow-hidden"
        >
          {email ? (
            <>
              <div className="px-4 py-3 border-b border-gray-200">
                <p className="text-xs text-gray-500">Signed in as</p>
                <p className="font-medium text-gray-800 truncate">{email}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${SYNC_DOT[syncStatus]}`} />
                  {syncStatus === 'error'
                    ? 'Not synced — will retry'
                    : syncStatus === 'syncing'
                      ? 'Syncing…'
                      : 'Synced across your devices'}
                </p>
              </div>
              <button
                role="menuitem"
                onClick={run(onSyncNow)}
                className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50"
              >
                Sync now
              </button>
              <button
                role="menuitem"
                onClick={run(onSignOut)}
                className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 border-t border-gray-200"
              >
                Sign out
              </button>
            </>
          ) : (
            <div className="px-4 py-4 space-y-3">
              <p className="font-medium text-gray-800">Not signed in</p>
              <p className="text-sm text-gray-600">
                Your data is saved on this device only. Sign in to keep it in sync across your phone and computer.
              </p>
              <button
                role="menuitem"
                onClick={run(onSignIn)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function App() {
  const [date] = useState(todayKey())
  const [limits, setLimits] = useState(() => loadLimits() || DEFAULT_LIMITS)
  const [consumed, setConsumed] = useState(() => loadDay(todayKey()) || EMPTY_CONSUMED)
  const [displayMode, setDisplayMode] = useState('grams')
  const [showPreferences, setShowPreferences] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)
  const [session, setSession] = useState(null)
  const [syncStatus, setSyncStatus] = useState('idle')

  const userId = session?.user?.id
  const pushTimer = useRef(null)

  // Keep track of who is signed in
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const sync = useCallback(async () => {
    if (!userId) return
    setSyncStatus('syncing')
    try {
      await syncWithCloud(userId)
      // Read back from the device so edits made during the sync aren't lost
      setLimits(loadLimits() || DEFAULT_LIMITS)
      setConsumed(loadDay(date) || EMPTY_CONSUMED)
      setSyncStatus('synced')
    } catch (err) {
      console.error('Sync failed', err)
      setSyncStatus('error')
    }
  }, [userId, date])

  // Sync on sign-in and whenever the app comes back to the foreground
  useEffect(() => {
    if (!userId) return
    sync()
    const onVisible = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', sync)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', sync)
    }
  }, [userId, sync])

  // After an edit, wait for a pause, then sync
  const scheduleSync = () => {
    if (!userId) return
    clearTimeout(pushTimer.current)
    pushTimer.current = setTimeout(sync, 1000)
  }

  const handleSaveLimits = (newLimits) => {
    setLimits(newLimits)
    saveLimits(newLimits)
    scheduleSync()
  }

  const handleUpdateConsumed = (key, value) => {
    const next = { ...consumed, [key]: value }
    setConsumed(next)
    saveDay(date, next)
    scheduleSync()
  }

  const clearToday = () => {
    setConsumed(EMPTY_CONSUMED)
    saveDay(date, EMPTY_CONSUMED)
    scheduleSync()
  }

  const handleSignOut = async () => {
    clearTimeout(pushTimer.current)
    await sync() // save any last changes first
    await supabase.auth.signOut()
    clearLocalData() // don't leave your data on a shared device
    setLimits(DEFAULT_LIMITS)
    setConsumed(EMPTY_CONSUMED)
    setSyncStatus('idle')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Nutrition Tracker</h1>
              <p className="text-gray-600 mt-1">{formatDate(date)}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreferences(true)}
                className="bg-white text-gray-800 border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                ⚙️ Preferences
              </button>
              <UserMenu
                session={session}
                syncStatus={syncStatus}
                onSignIn={() => setShowSignIn(true)}
                onSignOut={handleSignOut}
                onSyncNow={sync}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Dashboard
          limits={limits}
          consumed={consumed}
          displayMode={displayMode}
          onChangeDisplayMode={setDisplayMode}
          onUpdateConsumed={handleUpdateConsumed}
          onClear={clearToday}
        />
      </main>

      {showPreferences && (
        <PreferencesModal
          limits={limits}
          onSave={handleSaveLimits}
          onClose={() => setShowPreferences(false)}
        />
      )}

      {showSignIn && <SignInModal onClose={() => setShowSignIn(false)} />}
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
