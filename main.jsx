import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

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
    total += (consumed[key] * CALORIES_PER_100G[key]) / 100
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

// ---------- storage (localStorage, per device) ----------

const STORAGE_KEYS = {
  DAILY_LIMITS: 'nutrition_daily_limits',
  CONSUMED_AMOUNTS: 'nutrition_consumed_',
}

function saveLimits(limits) {
  localStorage.setItem(STORAGE_KEYS.DAILY_LIMITS, JSON.stringify(limits))
}

function loadLimits() {
  const raw = localStorage.getItem(STORAGE_KEYS.DAILY_LIMITS)
  return raw ? JSON.parse(raw) : null
}

function saveConsumed(date, consumed) {
  localStorage.setItem(STORAGE_KEYS.CONSUMED_AMOUNTS + date, JSON.stringify(consumed))
}

function loadConsumed(date) {
  const raw = localStorage.getItem(STORAGE_KEYS.CONSUMED_AMOUNTS + date)
  return raw ? JSON.parse(raw) : null
}

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

// ---------- components ----------

function NutrientCard({ label, limit, consumed, unit, displayMode, onChange, color }) {
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
        <h3 className="font-semibold text-gray-800">{label}</h3>
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

function Dashboard({ limits, consumed, displayMode, onToggleDisplayMode, onUpdateConsumed, onClear }) {
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
            <button
              onClick={onToggleDisplayMode}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              {displayMode === 'percentage' ? 'Show Grams' : 'Show Percentage'}
            </button>
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
        {Object.keys(consumed).map((key) => (
          <NutrientCard
            key={key}
            label={LABELS[key]}
            limit={limits[key]}
            consumed={consumed[key]}
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
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Daily Nutrition Preferences</h2>

        <div className="space-y-4">
          {Object.keys(draft).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <label className="text-gray-700 font-medium w-48">{LABELS[key]}</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step={key === 'calories' ? '10' : '1'}
                  value={draft[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-gray-600 w-16">{key === 'calories' ? 'kcal' : 'g'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Save Preferences
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function App() {
  const [date] = useState(todayKey())
  const [limits, setLimits] = useState(() => loadLimits() || DEFAULT_LIMITS)
  const [consumed, setConsumed] = useState(() => loadConsumed(todayKey()) || EMPTY_CONSUMED)
  const [displayMode, setDisplayMode] = useState('grams')
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    saveConsumed(date, consumed)
  }, [consumed, date])

  const handleSaveLimits = (newLimits) => {
    setLimits(newLimits)
    saveLimits(newLimits)
  }

  const handleUpdateConsumed = (key, value) => {
    setConsumed((prev) => ({ ...prev, [key]: value }))
  }

  const toggleDisplayMode = () => {
    setDisplayMode((mode) => (mode === 'grams' ? 'percentage' : 'grams'))
  }

  const clearToday = () => {
    setConsumed(EMPTY_CONSUMED)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Nutrition Tracker</h1>
              <p className="text-gray-600 mt-1">
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={() => setShowPreferences(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md hover:shadow-lg"
            >
              ⚙️ Preferences
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <Dashboard
          limits={limits}
          consumed={consumed}
          displayMode={displayMode}
          onToggleDisplayMode={toggleDisplayMode}
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
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
