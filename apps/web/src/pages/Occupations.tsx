import { useEffect, useState } from 'react'
import { occupationsApi } from '../api'
import type { Occupation } from '../api'

const CATEGORY_LABELS: Record<string, string> = {
  engineering: 'Engineering',
  product: 'Product',
  design: 'Design',
  data: 'Data & ML',
  business: 'Business',
  creative: 'Creative',
  science: 'Science',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  engineering: 'bg-purple-950 text-purple-400 border-purple-800',
  product: 'bg-blue-950 text-blue-400 border-blue-800',
  design: 'bg-pink-950 text-pink-400 border-pink-800',
  data: 'bg-cyan-950 text-cyan-400 border-cyan-800',
  business: 'bg-orange-950 text-orange-400 border-orange-800',
  creative: 'bg-green-950 text-green-400 border-green-800',
  science: 'bg-yellow-950 text-yellow-400 border-yellow-800',
  other: 'bg-gray-800 text-gray-400 border-gray-700',
}

const ACTIVE_OCCUPATION_KEY = 'claudeforge:activeOccupation'

export default function Occupations() {
  const [occupations, setOccupations] = useState<Occupation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [preview, setPreview] = useState<Occupation | null>(null)
  const [activeOccupation, setActiveOccupation] = useState<Occupation | null>(null)
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    occupationsApi.list().then(setOccupations).finally(() => setLoading(false))
    // Load persisted active occupation from localStorage
    const saved = localStorage.getItem(ACTIVE_OCCUPATION_KEY)
    if (saved) {
      try { setActiveOccupation(JSON.parse(saved)) } catch { /* ignore */ }
    }
  }, [])

  const applyOccupation = (occ: Occupation) => {
    setActiveOccupation(occ)
    localStorage.setItem(ACTIVE_OCCUPATION_KEY, JSON.stringify(occ))
    setApplied(true)
    setTimeout(() => setApplied(false), 2500)
    setPreview(null)
  }

  const clearOccupation = () => {
    setActiveOccupation(null)
    localStorage.removeItem(ACTIVE_OCCUPATION_KEY)
  }

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)]
  const filtered =
    filter === 'all' ? occupations : occupations.filter((o) => o.category === filter)

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Occupations</h1>
        <p className="text-gray-500 text-sm">
          Set your professional role so Claude agents adapt their language, depth, and style to match your background.
        </p>
      </div>

      {/* Active occupation banner */}
      {activeOccupation && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-brand-950 border border-brand-700 rounded-xl">
          <span className="text-2xl">{activeOccupation.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-brand-200">Active: {activeOccupation.title}</p>
            <p className="text-xs text-brand-400 mt-0.5">Agents adapt their language and depth to match your background.</p>
          </div>
          {applied && (
            <span className="text-xs text-green-400 font-medium animate-pulse">✓ Applied!</span>
          )}
          <button
            onClick={clearOccupation}
            className="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1">
            Clear
          </button>
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filter === cat
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500'
            }`}
          >
            {cat === 'all' ? 'All Roles' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading occupations…</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {filtered.map((occ) => {
            const isActive = activeOccupation?.id === occ.id
            const isPreviewing = preview?.id === occ.id
            return (
              <div
                key={occ.id}
                onClick={() => setPreview(isPreviewing ? null : occ)}
                className={`bg-gray-900 border rounded-xl p-5 flex flex-col cursor-pointer transition-all ${
                  isActive
                    ? 'border-brand-500 ring-1 ring-brand-500'
                    : isPreviewing
                      ? 'border-gray-600'
                      : 'border-gray-800 hover:border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl">{occ.icon}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm">{occ.title}</h3>
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium border ${
                        CATEGORY_COLORS[occ.category] ?? CATEGORY_COLORS.other
                      }`}
                    >
                      {CATEGORY_LABELS[occ.category]}
                    </span>
                  </div>
                  {isActive && (
                    <div className="text-xs text-brand-400 font-medium">✓ Active</div>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-400 text-sm mb-4 flex-1">{occ.description}</p>

                {/* Expertise areas */}
                <div className="mb-3">
                  <p className="text-gray-600 text-xs mb-2">Expertise areas:</p>
                  <div className="flex flex-wrap gap-1">
                    {occ.expertiseAreas.map((area) => (
                      <span
                        key={area}
                        className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded text-xs"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Communication style */}
                <p className="text-gray-600 text-xs italic mb-3">Style: {occ.communicationStyle}</p>

                {/* Apply button */}
                <button
                  onClick={e => { e.stopPropagation(); applyOccupation(occ) }}
                  className={`w-full text-xs py-2 rounded font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-700 text-brand-200 cursor-default'
                      : 'bg-gray-800 hover:bg-brand-600 text-gray-300 hover:text-white border border-gray-700 hover:border-brand-500'
                  }`}
                  disabled={isActive}
                >
                  {isActive ? '✓ Currently active' : 'Set as my occupation'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-500">No roles in this category.</div>
      )}

      {/* Preview panel — shows system prompt suffix */}
      {preview && (
        <div className="fixed bottom-6 right-6 w-96 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-5 z-40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{preview.icon}</span>
              <span className="font-semibold text-white text-sm">{preview.title}</span>
            </div>
            <button
              onClick={() => setPreview(null)}
              className="text-gray-500 hover:text-gray-300 text-lg leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-gray-500 text-xs mb-3">
            System prompt appended to all agent calls when this occupation is active:
          </p>
          <div className="bg-gray-800 rounded-lg px-3 py-2.5 text-gray-300 text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-48 overflow-y-auto mb-3">
            {preview.systemPromptSuffix}
          </div>
          <button
            onClick={() => applyOccupation(preview)}
            className={`w-full text-sm py-2 rounded font-medium transition-colors ${
              activeOccupation?.id === preview.id
                ? 'bg-brand-700 text-brand-200 cursor-default'
                : 'bg-brand-600 hover:bg-brand-500 text-white'
            }`}
            disabled={activeOccupation?.id === preview.id}
          >
            {activeOccupation?.id === preview.id ? '✓ Already active' : 'Set as my occupation'}
          </button>
        </div>
      )}
    </div>
  )
}
