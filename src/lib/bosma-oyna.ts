// Uzoq tayyorlanadigan bosma hujjat uchun oyna (faqat brauzer).
//
// Brauzer yangi oynani faqat bosish paytida ochishga ruxsat beradi: rasm
// tayyorlash kabi bir necha soniyalik ishdan KEYIN `window.open` chaqirilsa,
// u "qalqib chiquvchi oyna" deb to'siladi. Shuning uchun oyna bosilgan
// zahoti ochiladi ("Tayyorlanmoqda…"), hujjat esa tayyor bo'lgach yoziladi.

export interface BosmaOynasi {
  /** Tayyor hujjatni yozadi, rasmlar chizilgach bosma oynasini ochadi. */
  chopEt(html: string): Promise<void>
  /** Xato bo'lsa — bo'sh qolgan oynani yopish. */
  yop(): void
}

/** `null` — brauzer oynani to'sdi. */
export function bosmaOynasiniOch(kutishMatni = 'Tayyorlanmoqda…'): BosmaOynasi | null {
  const oyna = window.open('', '_blank', 'width=900,height=1100')
  if (!oyna) return null
  oyna.document.write(
    '<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>' + kutishMatni + '</title></head>'
    + '<body style="margin:0;height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#555">'
    + '<p>' + kutishMatni + '</p></body></html>',
  )
  oyna.document.close()

  return {
    async chopEt(html) {
      // Xaridor kutish oynasini yopib qo'ygan bo'lsa — hech narsa qilmaymiz
      if (oyna.closed) return
      oyna.document.open()
      oyna.document.write(html)
      oyna.document.close()
      // Rasmlar chizilmasdan bosma oynasi ochilsa, ular bo'sh chiqadi
      await Promise.all(Array.from(oyna.document.images).map(r => r.decode().catch(() => {})))
      if (oyna.closed) return
      oyna.focus()
      // Oyna ochiq qoladi: katalogni ko'rib chiqish yoki PDF qilib qayta saqlash uchun
      oyna.print()
    },
    yop() {
      if (!oyna.closed) oyna.close()
    },
  }
}
