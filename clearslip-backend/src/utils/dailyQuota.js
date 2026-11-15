/**
 * Counts something per visitor per day (UTC), in memory: used to cap how many AI
 * answers one visitor can take from the allowance every visitor shares. Counts are
 * cleared when the day changes, so the map never outgrows one day's visitors.
 * A limit of 0 turns the cap off.
 */
export function createDailyQuota(limit, now = Date.now) {
  const used = new Map() // visitor → count today
  let day = null
  const startDay = () => {
    const today = new Date(now()).toISOString().slice(0, 10)
    if (today !== day) {
      used.clear()
      day = today
    }
  }
  return {
    allows(visitor) {
      if (!limit) return true
      startDay()
      return (used.get(visitor) ?? 0) < limit
    },
    count(visitor) {
      if (!limit) return
      startDay()
      used.set(visitor, (used.get(visitor) ?? 0) + 1)
    },
  }
}
