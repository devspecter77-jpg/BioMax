// Qisqa ikki tonli ovozli signal — fayl yuklamasdan. Brauzer ovozga ruxsat
// bermasa (foydalanuvchi sahifaga hali tegmagan) jim o'tadi.

export function signalBer(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[880, 1175].forEach((chastota, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      const boshi = ctx.currentTime + i * 0.18
      o.type = 'sine'
      o.frequency.value = chastota
      g.gain.setValueAtTime(0.0001, boshi)
      g.gain.exponentialRampToValueAtTime(0.18, boshi + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, boshi + 0.3)
      o.connect(g).connect(ctx.destination)
      o.start(boshi)
      o.stop(boshi + 0.32)
    })
    setTimeout(() => void ctx.close(), 900)
  } catch {
    // Ovoz ixtiyoriy
  }
}
