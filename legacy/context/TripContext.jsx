import { createContext, useContext, useMemo, useState } from 'react'
import { INITIAL_TRIPS } from '../data/trips'

/**
 * 全局 trip 状态。接后端时把 useState 换成请求/缓存即可，
 * 组件不需要改动 —— 它们只认 useTrips() 返回的形状。
 */
const TripContext = createContext(null)

export function TripProvider({ children }) {
  const [trips, setTrips] = useState(INITIAL_TRIPS)

  const value = useMemo(() => ({
    trips,
    getTrip: id => trips.find(t => t.id === id),

    /** 推进阶段：把当前阶段记为完成，解锁并切到下一阶段 */
    advance: (tripId, side, nextStage) =>
      setTrips(prev => prev.map(t => {
        if (t.id !== tripId) return t
        const p = t[side]
        return {
          ...t,
          [side]: {
            ...p,
            done: p.done.includes(p.current) ? p.done : [...p.done, p.current],
            current: nextStage,
            locked: p.locked.filter(x => x !== nextStage),
          },
        }
      })),

    /** 归档与锁定正交：归档只影响列表可见性，可逆 */
    toggleArchive: tripId =>
      setTrips(prev => prev.map(t => (t.id === tripId ? { ...t, archived: !t.archived } : t))),
  }), [trips])

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>
}

export function useTrips() {
  const ctx = useContext(TripContext)
  if (!ctx) throw new Error('useTrips must be used inside <TripProvider>')
  return ctx
}
