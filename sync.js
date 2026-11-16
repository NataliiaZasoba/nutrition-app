import { createClient } from '@supabase/supabase-js'

// Set these in Vercel → Project → Settings → Environment Variables.
// If they are missing, the app works offline only and hides sign-in.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null

// ---------- local storage (source of truth on this device) ----------

const KEYS = {
  LIMITS: 'nutrition_daily_limits',
  DAY_PREFIX: 'nutrition_consumed_',
  META: 'nutrition_meta', // { limitsUpdatedAt, days: { [date]: updatedAt } }
  OWNER: 'nutrition_owner', // user id the local data belongs to
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked — ignore */
  }
}

function readMeta() {
  const meta = readJSON(KEYS.META) || {}
  return { limitsUpdatedAt: meta.limitsUpdatedAt || 0, days: meta.days || {} }
}

export function loadLimits() {
  return readJSON(KEYS.LIMITS)
}

export function loadDay(date) {
  return readJSON(KEYS.DAY_PREFIX + date)
}

export function saveLimits(limits) {
  writeJSON(KEYS.LIMITS, limits)
  const meta = readMeta()
  meta.limitsUpdatedAt = Date.now()
  writeJSON(KEYS.META, meta)
}

export function saveDay(date, consumed) {
  writeJSON(KEYS.DAY_PREFIX + date, consumed)
  const meta = readMeta()
  meta.days[date] = Date.now()
  writeJSON(KEYS.META, meta)
}

// Everything on this device as one object, with a timestamp per record.
export function loadSnapshot() {
  const meta = readMeta()
  const days = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(KEYS.DAY_PREFIX)) {
      const date = k.slice(KEYS.DAY_PREFIX.length)
      const consumed = readJSON(k)
      if (consumed) days[date] = { consumed, updatedAt: meta.days[date] || 0 }
    }
  }
  const limits = loadLimits()
  return { limits, limitsUpdatedAt: limits ? meta.limitsUpdatedAt : 0, days }
}

function writeSnapshot(snap) {
  const meta = { limitsUpdatedAt: snap.limitsUpdatedAt || 0, days: {} }
  if (snap.limits) writeJSON(KEYS.LIMITS, snap.limits)
  for (const [date, day] of Object.entries(snap.days || {})) {
    writeJSON(KEYS.DAY_PREFIX + date, day.consumed)
    meta.days[date] = day.updatedAt || 0
  }
  writeJSON(KEYS.META, meta)
}

// For each record, the newer version wins.
function mergeSnapshots(local, remote) {
  if (!remote) return local
  const out = {
    limits: local.limits,
    limitsUpdatedAt: local.limitsUpdatedAt || 0,
    days: { ...local.days },
  }
  if (remote.limits && (remote.limitsUpdatedAt || 0) > out.limitsUpdatedAt) {
    out.limits = remote.limits
    out.limitsUpdatedAt = remote.limitsUpdatedAt
  }
  for (const [date, day] of Object.entries(remote.days || {})) {
    const mine = out.days[date]
    if (!mine || (day.updatedAt || 0) > (mine.updatedAt || 0)) out.days[date] = day
  }
  return out
}

export function clearLocalData() {
  const toRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('nutrition_')) toRemove.push(k)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
}

// If another account used this device before, don't mix its data in.
function claimLocalData(userId) {
  const owner = localStorage.getItem(KEYS.OWNER)
  if (owner && owner !== userId) clearLocalData()
  localStorage.setItem(KEYS.OWNER, userId)
}

// ---------- cloud ----------

// Pull from the cloud, merge with this device, save both. Returns the merged snapshot.
export async function syncWithCloud(userId) {
  claimLocalData(userId)

  const { data, error } = await supabase
    .from('nutrition_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error

  const merged = mergeSnapshots(loadSnapshot(), data?.data ?? null)
  writeSnapshot(merged)

  const { error: pushError } = await supabase
    .from('nutrition_state')
    .upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() })
  if (pushError) throw pushError

  return merged
}
