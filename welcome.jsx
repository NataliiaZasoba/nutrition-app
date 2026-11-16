import illustration from './illustration.js'

// Shown on the first visit only, kept outside the 'nutrition_' keys so signing out doesn't reset it
const WELCOME_KEY = 'nt_welcome_seen'

export function hasSeenWelcome() {
  try {
    return localStorage.getItem(WELCOME_KEY) === '1'
  } catch {
    return true // storage blocked: don't trap people on the welcome screen
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_KEY, '1')
  } catch {
    /* ignore */
  }
}

const BENEFITS = [
  'Set your daily goal',
  'Add your nutrition limits',
  'Drag or type to log what you’ve eaten',
  'See what’s left for today',
]

export default function Welcome({ onOpen }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-slate-50 text-slate-900">
      {/* Soft background shapes */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-blue-100/70 blur-3xl" />
        <div className="absolute -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full bg-indigo-100/60 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-[100dvh] max-w-6xl items-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="grid w-full items-center gap-y-8 md:grid-cols-2 md:gap-x-12 lg:gap-x-16">
          {/* Name, headline and benefits */}
          <div className="md:col-start-1 md:row-start-1 md:self-end">
            <p className="text-lg font-bold leading-tight tracking-tight text-slate-900">Nutrition Tracker</p>

            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
              Spend seconds adding your food.
              <span className="mt-2 block font-semibold text-slate-500">No searching or barcodes.</span>
            </h1>

            <ul className="mt-8 space-y-3 text-lg text-slate-700">
              {BENEFITS.map((item) => (
                <li key={item} className="flex items-baseline gap-3">
                  <span aria-hidden="true" className="h-2 w-2 shrink-0 translate-y-[-2px] rounded-full bg-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Illustration: below the benefits on mobile, right column on desktop */}
          <div className="md:col-start-2 md:row-span-2 md:row-start-1">
            <img
              src={illustration}
              width="760"
              height="542"
              alt="Blue shaker bottle, kettlebell, dumbbell and a bowl of salmon, quinoa and vegetables"
              className="mx-auto h-auto w-full max-w-md object-contain drop-shadow-xl md:max-w-none"
            />
          </div>

          {/* Call to action */}
          <div className="md:col-start-1 md:row-start-2 md:self-start">
            <button
              type="button"
              onClick={onOpen}
              aria-label="Open Nutrition Tracker"
              className="w-full rounded-xl bg-blue-600 px-10 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/25 transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-300 md:w-auto md:min-w-[16rem]"
            >
              Open
            </button>
            <p className="mt-4 text-center text-sm text-slate-500 md:text-left">
              Your tracker resets automatically each day, ready for a fresh start.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
