import 'dotenv/config'
import { PrismaClient, Rol, Birlik, TolovUsuli, NasiyaHolati, XarajatKategoriya } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function rndItem<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function generateBarcode() { return String(rnd(1000000000000, 9999999999999)) }

async function main() {
  console.log('Seed boshlandi...')

  // ==================== FOYDALANUVCHILAR ====================
  const users = [
    { ism: "Administrator", login: "admin", parol: "admin123", rol: Rol.ADMIN },
    { ism: "Jasur Kassir", login: "kassir1", parol: "kassir123", rol: Rol.KASSIR },
    { ism: "Dilnoza Kassir", login: "kassir2", parol: "kassir234", rol: Rol.KASSIR },
    { ism: "Sardor Omborchi", login: "omborchi", parol: "ombor123", rol: Rol.OMBORCHI },
    { ism: "Rahbar Xodim", login: "rahbar", parol: "rahbar123", rol: Rol.ADMIN },
  ]

  const createdUsers: any[] = []
  for (const u of users) {
    const hash = await bcrypt.hash(u.parol, 10)
    const user = await prisma.foydalanuvchi.upsert({
      where: { login: u.login },
      update: { ism: u.ism, rol: u.rol },
      create: { ism: u.ism, login: u.login, parolHash: hash, rol: u.rol },
    })
    createdUsers.push(user)
  }
  const admin = createdUsers[0]
  const kassirlar = [createdUsers[1], createdUsers[2]]
  console.log('Foydalanuvchilar:', createdUsers.length)

  // ==================== SOZLAMALAR ====================
  const sozlamalarData = [
    { kalit: 'dokon_nomi', qiymat: "Optimum Xo'jalik Mollari" },
    { kalit: 'manzil', qiymat: "Toshkent sh., Chilonzor tumani, 7-mavze" },
    { kalit: 'telefon', qiymat: "+998 71 123 45 67" },
    { kalit: 'valyuta', qiymat: "UZS" },
    { kalit: 'chek_matni', qiymat: "Xaridingiz uchun rahmat!" },
    { kalit: 'sahifadagi_elementlar', qiymat: "25" },
    { kalit: 'default_view', qiymat: "table" },
  ]
  for (const s of sozlamalarData) {
    await prisma.sozlama.upsert({ where: { kalit: s.kalit }, update: { qiymat: s.qiymat }, create: s })
  }
  console.log('Sozlamalar saqlandi')

  // ==================== KATEGORIYALAR ====================
  const kategoriyalarData = [
    { nomi: 'Tozalash vositalari', tavsif: 'Kir yuvish, uy tozalash vositalari' },
    { nomi: 'Idish-tovoq', tavsif: 'Oshxona idishlari va anjomlar' },
    { nomi: 'Polietilen mahsulotlari', tavsif: 'Paketlar, qoplar, plyonkalar' },
    { nomi: 'Shvabra va supurgichlar', tavsif: 'Pol tozalash vositalari' },
    { nomi: 'Chelaklar va lavvorlar', tavsif: 'Turli hajmdagi chelaklar' },
    { nomi: 'Plastik idishlar', tavsif: 'Oziq-ovqat saqlash uchun idishlar' },
    { nomi: "Bog' asboblari", tavsif: "Bog' va qishloq xo'jaligi uchun" },
    { nomi: 'Elektr jihozlar', tavsif: 'Uy elektr jihozlari' },
    { nomi: "Qog'oz mahsulotlari", tavsif: "Tualet qog'ozi, salfetka, qog'oz sochiq" },
    { nomi: 'Gigiena vositalari', tavsif: 'Shampun, sovun, tish pastasi' },
    { nomi: 'Maishiy kimyo', tavsif: 'Kir yuvish kukunlari, kimyoviy vositalar' },
    { nomi: 'Savatlar va qutichalar', tavsif: 'Plastik savatlar va qutichalar' },
    { nomi: 'Yoritish vositalari', tavsif: 'Lampalar, sham, fonar' },
    { nomi: 'Oziq-ovqat', tavsif: 'Kundalik oziq-ovqat mahsulotlari' },
    { nomi: 'Boshqa', tavsif: "Boshqa xo'jalik mollari" },
  ]

  const kategoriyalar: any[] = []
  for (const k of kategoriyalarData) {
    const kat = await prisma.kategoriya.upsert({ where: { nomi_filialId_egaId: { nomi: k.nomi, filialId: null as any, egaId: null as any } }, update: {}, create: k })
    kategoriyalar.push(kat)
  }
  const katMap: Record<string, string> = {}
  for (const k of kategoriyalar) katMap[k.nomi] = k.id
  console.log('Kategoriyalar:', kategoriyalar.length)

  // ==================== TOVARLAR (110+) ====================
  const tovarlarData = [
    // Tozalash vositalari
    { nomi: 'Domestos 1L', kat: 'Tozalash vositalari', kelish: 12000, ustama: 30, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Fairy 500ml', kat: 'Tozalash vositalari', kelish: 8000, ustama: 35, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Pril 450ml', kat: 'Tozalash vositalari', kelish: 7500, ustama: 30, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Mr.Proper 750ml', kat: 'Tozalash vositalari', kelish: 14000, ustama: 28, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Cif krem 500ml', kat: 'Tozalash vositalari', kelish: 13000, ustama: 30, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Comet poroshok 400g', kat: 'Tozalash vositalari', kelish: 6000, ustama: 35, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Frosch 750ml', kat: 'Tozalash vositalari', kelish: 16000, ustama: 25, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Cilit Bang 750ml', kat: 'Tozalash vositalari', kelish: 18000, ustama: 28, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Duck Tozalovchi 750ml', kat: 'Tozalash vositalari', kelish: 9000, ustama: 33, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Shisha tozalagich 500ml', kat: 'Tozalash vositalari', kelish: 8500, ustama: 30, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Mebel tozalagich spray', kat: 'Tozalash vositalari', kelish: 11000, ustama: 32, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Antikal 500ml', kat: 'Tozalash vositalari', kelish: 10000, ustama: 30, birlik: Birlik.DONA, min: 10 },

    // Maishiy kimyo
    { nomi: 'Ariel 3kg', kat: 'Maishiy kimyo', kelish: 45000, ustama: 22, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Tide 3kg', kat: 'Maishiy kimyo', kelish: 43000, ustama: 22, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Persil 3kg', kat: 'Maishiy kimyo', kelish: 47000, ustama: 20, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Ariel 1.5kg', kat: 'Maishiy kimyo', kelish: 24000, ustama: 22, birlik: Birlik.DONA, min: 15 },
    { nomi: 'OMO 2kg', kat: 'Maishiy kimyo', kelish: 28000, ustama: 22, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Vanish oqartiruvchi 500ml', kat: 'Maishiy kimyo', kelish: 22000, ustama: 28, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Lenor yumshatuvchi 1L', kat: 'Maishiy kimyo', kelish: 18000, ustama: 28, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Comfort yumshatuvchi 1L', kat: 'Maishiy kimyo', kelish: 15000, ustama: 28, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Persil gel 1.5L', kat: 'Maishiy kimyo', kelish: 42000, ustama: 22, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Tide gel 1L', kat: 'Maishiy kimyo', kelish: 32000, ustama: 22, birlik: Birlik.DONA, min: 8 },

    // Gigiena vositalari
    { nomi: 'Head And Shoulders 400ml', kat: 'Gigiena vositalari', kelish: 22000, ustama: 28, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Pantene 400ml', kat: 'Gigiena vositalari', kelish: 21000, ustama: 28, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Dove shampun 400ml', kat: 'Gigiena vositalari', kelish: 23000, ustama: 26, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Colgate tish pastasi 150g', kat: 'Gigiena vositalari', kelish: 9000, ustama: 40, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Oral-B tish pastasi 125g', kat: 'Gigiena vositalari', kelish: 11000, ustama: 38, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Lifebuoy sovun 90g', kat: 'Gigiena vositalari', kelish: 4500, ustama: 40, birlik: Birlik.DONA, min: 30 },
    { nomi: 'Dove sovun 100g', kat: 'Gigiena vositalari', kelish: 6000, ustama: 38, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Safeguard sovun 90g', kat: 'Gigiena vositalari', kelish: 5000, ustama: 38, birlik: Birlik.DONA, min: 25 },
    { nomi: 'Gillette stanok 2ta', kat: 'Gigiena vositalari', kelish: 8500, ustama: 40, birlik: Birlik.PACHKA, min: 15 },
    { nomi: 'Venus stanok 2ta', kat: 'Gigiena vositalari', kelish: 9000, ustama: 38, birlik: Birlik.PACHKA, min: 12 },
    { nomi: 'Rexona dezodorant 150ml', kat: 'Gigiena vositalari', kelish: 12000, ustama: 35, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Sure dezodorant 150ml', kat: 'Gigiena vositalari', kelish: 11500, ustama: 35, birlik: Birlik.DONA, min: 12 },

    // Qog'oz mahsulotlari
    { nomi: 'Zewa WC qogoz 8ta', kat: "Qog'oz mahsulotlari", kelish: 18000, ustama: 25, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'Papia WC qogoz 8ta', kat: "Qog'oz mahsulotlari", kelish: 15000, ustama: 28, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'WC qogoz 4ta ekonom', kat: "Qog'oz mahsulotlari", kelish: 7000, ustama: 30, birlik: Birlik.PACHKA, min: 30 },
    { nomi: 'Salfetka 100ta', kat: "Qog'oz mahsulotlari", kelish: 5000, ustama: 35, birlik: Birlik.PACHKA, min: 25 },
    { nomi: 'Qogoz sochiq 2ta', kat: "Qog'oz mahsulotlari", kelish: 12000, ustama: 28, birlik: Birlik.PACHKA, min: 15 },
    { nomi: 'Yuz salfetka 200ta', kat: "Qog'oz mahsulotlari", kelish: 8000, ustama: 30, birlik: Birlik.QUTI, min: 20 },
    { nomi: 'Gigiena prokladka 10ta', kat: "Qog'oz mahsulotlari", kelish: 8500, ustama: 32, birlik: Birlik.PACHKA, min: 15 },
    { nomi: 'Tana salfetka 15ta', kat: "Qog'oz mahsulotlari", kelish: 7500, ustama: 30, birlik: Birlik.PACHKA, min: 18 },

    // Idish-tovoq
    { nomi: 'Temir kosa toplami 6ta', kat: 'Idish-tovoq', kelish: 35000, ustama: 30, birlik: Birlik.QUTI, min: 5 },
    { nomi: 'Plastik kosa toplami 6ta', kat: 'Idish-tovoq', kelish: 12000, ustama: 35, birlik: Birlik.QUTI, min: 10 },
    { nomi: 'Shisha banka 1L 3ta', kat: 'Idish-tovoq', kelish: 18000, ustama: 28, birlik: Birlik.QUTI, min: 8 },
    { nomi: 'Shisha banka 0.5L 6ta', kat: 'Idish-tovoq', kelish: 22000, ustama: 25, birlik: Birlik.QUTI, min: 8 },
    { nomi: 'Qoshiq-vilkalar toplami 12ta', kat: 'Idish-tovoq', kelish: 15000, ustama: 33, birlik: Birlik.QUTI, min: 8 },
    { nomi: 'Non kesish taxtasi', kat: 'Idish-tovoq', kelish: 8000, ustama: 40, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Temir qozon 5L', kat: 'Idish-tovoq', kelish: 85000, ustama: 25, birlik: Birlik.DONA, min: 3 },
    { nomi: 'Non savat', kat: 'Idish-tovoq', kelish: 12000, ustama: 35, birlik: Birlik.DONA, min: 5 },
    { nomi: "Yog' quyish idishi 1L", kat: 'Idish-tovoq', kelish: 7500, ustama: 35, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Alyuminiy togora', kat: 'Idish-tovoq', kelish: 25000, ustama: 30, birlik: Birlik.DONA, min: 5 },

    // Polietilen mahsulotlari
    { nomi: 'Polietilen paket 30x40 100ta', kat: 'Polietilen mahsulotlari', kelish: 8000, ustama: 40, birlik: Birlik.PACHKA, min: 30 },
    { nomi: 'Polietilen paket 20x30 100ta', kat: 'Polietilen mahsulotlari', kelish: 5000, ustama: 45, birlik: Birlik.PACHKA, min: 40 },
    { nomi: 'Axlat paketi 60L 10ta', kat: 'Polietilen mahsulotlari', kelish: 6500, ustama: 38, birlik: Birlik.PACHKA, min: 25 },
    { nomi: 'Axlat paketi 120L 5ta', kat: 'Polietilen mahsulotlari', kelish: 8000, ustama: 35, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'Oziq-ovqat plyonkasi 30m', kat: 'Polietilen mahsulotlari', kelish: 9000, ustama: 32, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Folgali qogoz 10m', kat: 'Polietilen mahsulotlari', kelish: 12000, ustama: 28, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Muzlatgich paketi 30ta', kat: 'Polietilen mahsulotlari', kelish: 7000, ustama: 38, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'Polietilen qop 50kg', kat: 'Polietilen mahsulotlari', kelish: 3000, ustama: 45, birlik: Birlik.DONA, min: 50 },

    // Shvabra va supurgichlar
    { nomi: 'Shvabra toplami', kat: 'Shvabra va supurgichlar', kelish: 35000, ustama: 30, birlik: Birlik.DONA, min: 5 },
    { nomi: 'Supurgi', kat: 'Shvabra va supurgichlar', kelish: 12000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Shvabra boshi', kat: 'Shvabra va supurgichlar', kelish: 15000, ustama: 32, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Elektr supurgi kichik', kat: 'Shvabra va supurgichlar', kelish: 120000, ustama: 28, birlik: Birlik.DONA, min: 3 },
    { nomi: 'Konteyner supurgi', kat: 'Shvabra va supurgichlar', kelish: 25000, ustama: 32, birlik: Birlik.DONA, min: 5 },
    { nomi: 'Pol artish sochiq 5ta', kat: 'Shvabra va supurgichlar', kelish: 18000, ustama: 30, birlik: Birlik.QUTI, min: 8 },
    { nomi: 'Dizenfeksiya uchun shvabra', kat: 'Shvabra va supurgichlar', kelish: 45000, ustama: 28, birlik: Birlik.DONA, min: 3 },

    // Chelaklar va lavvorlar
    { nomi: 'Chelak 10L sariq', kat: 'Chelaklar va lavvorlar', kelish: 18000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Chelak 15L qizil', kat: 'Chelaklar va lavvorlar', kelish: 22000, ustama: 32, birlik: Birlik.DONA, min: 6 },
    { nomi: 'Chelak 20L kok', kat: 'Chelaklar va lavvorlar', kelish: 28000, ustama: 30, birlik: Birlik.DONA, min: 5 },
    { nomi: 'Lavvor kichik', kat: 'Chelaklar va lavvorlar', kelish: 15000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: "Lavvor o'rta", kat: 'Chelaklar va lavvorlar', kelish: 22000, ustama: 32, birlik: Birlik.DONA, min: 6 },
    { nomi: 'Lavvor katta', kat: 'Chelaklar va lavvorlar', kelish: 32000, ustama: 28, birlik: Birlik.DONA, min: 4 },
    { nomi: 'Plastik kuvur 5L', kat: 'Chelaklar va lavvorlar', kelish: 12000, ustama: 38, birlik: Birlik.DONA, min: 10 },

    // Plastik idishlar
    { nomi: 'Plastik quti 0.5L', kat: 'Plastik idishlar', kelish: 4000, ustama: 45, birlik: Birlik.DONA, min: 25 },
    { nomi: 'Plastik quti 1L', kat: 'Plastik idishlar', kelish: 5500, ustama: 42, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Plastik quti 2L', kat: 'Plastik idishlar', kelish: 7500, ustama: 40, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Plastik quti 5L', kat: 'Plastik idishlar', kelish: 12000, ustama: 35, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Plastik quti toplami 6ta', kat: 'Plastik idishlar', kelish: 25000, ustama: 32, birlik: Birlik.QUTI, min: 8 },
    { nomi: 'Oziq-ovqat konteyner', kat: 'Plastik idishlar', kelish: 9000, ustama: 38, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Suv butilkasi 1.5L', kat: 'Plastik idishlar', kelish: 5000, ustama: 40, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Termos idish', kat: 'Plastik idishlar', kelish: 35000, ustama: 30, birlik: Birlik.DONA, min: 5 },

    // Bog' asboblari
    { nomi: 'Ketmon', kat: "Bog' asboblari", kelish: 35000, ustama: 28, birlik: Birlik.DONA, min: 5 },
    { nomi: 'Belkurak', kat: "Bog' asboblari", kelish: 28000, ustama: 30, birlik: Birlik.DONA, min: 5 },
    { nomi: "O'roq", kat: "Bog' asboblari", kelish: 15000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: "Sugvorish shlangi 20m", kat: "Bog' asboblari", kelish: 85000, ustama: 25, birlik: Birlik.DONA, min: 3 },
    { nomi: 'Plastik bak 200L', kat: "Bog' asboblari", kelish: 180000, ustama: 22, birlik: Birlik.DONA, min: 2 },
    { nomi: 'Plastik bak 100L', kat: "Bog' asboblari", kelish: 95000, ustama: 25, birlik: Birlik.DONA, min: 3 },
    { nomi: "Bog' makasi", kat: "Bog' asboblari", kelish: 25000, ustama: 32, birlik: Birlik.DONA, min: 5 },

    // Elektr jihozlar
    { nomi: 'LED lampa 9W', kat: 'Elektr jihozlar', kelish: 8000, ustama: 40, birlik: Birlik.DONA, min: 20 },
    { nomi: 'LED lampa 15W', kat: 'Elektr jihozlar', kelish: 12000, ustama: 38, birlik: Birlik.DONA, min: 15 },
    { nomi: 'LED lampa 20W', kat: 'Elektr jihozlar', kelish: 16000, ustama: 35, birlik: Birlik.DONA, min: 10 },
    { nomi: 'Rozetka 3 shtoker', kat: 'Elektr jihozlar', kelish: 18000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Uzatma sim 3m', kat: 'Elektr jihozlar', kelish: 25000, ustama: 32, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Batareya AA 4ta', kat: 'Elektr jihozlar', kelish: 8000, ustama: 40, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'Batareya AAA 4ta', kat: 'Elektr jihozlar', kelish: 8000, ustama: 40, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'Fonar kuchli', kat: 'Elektr jihozlar', kelish: 35000, ustama: 30, birlik: Birlik.DONA, min: 5 },

    // Savatlar va qutichalar
    { nomi: 'Plastik savat katta', kat: 'Savatlar va qutichalar', kelish: 25000, ustama: 32, birlik: Birlik.DONA, min: 6 },
    { nomi: "Plastik savat o'rta", kat: 'Savatlar va qutichalar', kelish: 18000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Kiyim saqlash qutisi', kat: 'Savatlar va qutichalar', kelish: 35000, ustama: 30, birlik: Birlik.DONA, min: 5 },
    { nomi: 'Poyabzal qutisi', kat: 'Savatlar va qutichalar', kelish: 18000, ustama: 35, birlik: Birlik.DONA, min: 8 },
    { nomi: 'Plastik organayzer', kat: 'Savatlar va qutichalar', kelish: 28000, ustama: 30, birlik: Birlik.DONA, min: 5 },
    { nomi: 'Meva-sabzavot savat', kat: 'Savatlar va qutichalar', kelish: 15000, ustama: 38, birlik: Birlik.DONA, min: 10 },

    // Yoritish vositalari
    { nomi: 'Sham klassik 10ta', kat: 'Yoritish vositalari', kelish: 6000, ustama: 42, birlik: Birlik.PACHKA, min: 20 },
    { nomi: 'Sham aromatik', kat: 'Yoritish vositalari', kelish: 12000, ustama: 38, birlik: Birlik.DONA, min: 12 },
    { nomi: 'LED chirogi', kat: 'Yoritish vositalari', kelish: 45000, ustama: 28, birlik: Birlik.DONA, min: 5 },
    { nomi: "Qo'l chirogi kichik", kat: 'Yoritish vositalari', kelish: 18000, ustama: 35, birlik: Birlik.DONA, min: 8 },

    // Oziq-ovqat
    { nomi: 'Tuz 1kg', kat: 'Oziq-ovqat', kelish: 3500, ustama: 40, birlik: Birlik.DONA, min: 30 },
    { nomi: 'Qand 1kg', kat: 'Oziq-ovqat', kelish: 8000, ustama: 30, birlik: Birlik.KG, min: 20 },
    { nomi: 'Un 2kg', kat: 'Oziq-ovqat', kelish: 12000, ustama: 25, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Makaron 400g', kat: 'Oziq-ovqat', kelish: 5000, ustama: 35, birlik: Birlik.DONA, min: 30 },
    { nomi: 'Guruch 1kg', kat: 'Oziq-ovqat', kelish: 9000, ustama: 28, birlik: Birlik.KG, min: 25 },
    { nomi: "O'simlik yogi 1L", kat: 'Oziq-ovqat', kelish: 22000, ustama: 22, birlik: Birlik.DONA, min: 20 },
    { nomi: 'Choy qop 25ta', kat: 'Oziq-ovqat', kelish: 12000, ustama: 30, birlik: Birlik.QUTI, min: 15 },
    { nomi: 'Qora choy 100g', kat: 'Oziq-ovqat', kelish: 15000, ustama: 28, birlik: Birlik.DONA, min: 12 },
    { nomi: 'Kafe 100g', kat: 'Oziq-ovqat', kelish: 35000, ustama: 25, birlik: Birlik.DONA, min: 10 },

    // Boshqa
    { nomi: 'Rezina qolqop S', kat: 'Boshqa', kelish: 4000, ustama: 45, birlik: Birlik.PACHKA, min: 25 },
    { nomi: 'Rezina qolqop M', kat: 'Boshqa', kelish: 4000, ustama: 45, birlik: Birlik.PACHKA, min: 25 },
    { nomi: 'Rezina qolqop L', kat: 'Boshqa', kelish: 4000, ustama: 45, birlik: Birlik.PACHKA, min: 25 },
    { nomi: 'Temir orindiq', kat: 'Boshqa', kelish: 75000, ustama: 25, birlik: Birlik.DONA, min: 3 },
    { nomi: 'Plastik stul', kat: 'Boshqa', kelish: 45000, ustama: 28, birlik: Birlik.DONA, min: 4 },
    { nomi: 'Ip katak 50m', kat: 'Boshqa', kelish: 8000, ustama: 40, birlik: Birlik.DONA, min: 15 },
    { nomi: 'Temir tasma 5m', kat: 'Boshqa', kelish: 12000, ustama: 35, birlik: Birlik.DONA, min: 10 },
  ]

  const createdTovarlar: any[] = []
  for (const t of tovarlarData) {
    const katId = katMap[t.kat]
    if (!katId) continue
    const sotish = Math.round(t.kelish * (1 + t.ustama / 100) / 100) * 100
    const mavjud = await prisma.tovar.findFirst({ where: { nomi: t.nomi } })
    let tovar: any
    if (!mavjud) {
      tovar = await prisma.tovar.create({
        data: {
          nomi: t.nomi,
          kategoriyaId: katId,
          shtrixKod: generateBarcode(),
          kelishNarxi: t.kelish,
          sotishNarxi: sotish,
          birlik: t.birlik,
          minimalQoldiq: t.min,
        }
      })
      const qoldiq = rnd(20, 150)
      await prisma.omborHarakati.create({
        data: {
          tovarId: tovar.id,
          turi: 'KIRIM',
          miqdor: qoldiq,
          narx: t.kelish,
          izoh: "Boshlang'ich qoldiq",
          foydalanuvchiId: admin.id,
          sana: daysAgo(rnd(90, 120)),
        }
      })
    } else {
      tovar = mavjud
    }
    createdTovarlar.push(tovar)
  }
  console.log('Tovarlar:', createdTovarlar.length)

  // ==================== TAMINOTCHILAR ====================
  const taminotchilarData = [
    { nomi: "Procter And Gamble Uzbekiston", kontaktShaxs: "Bahodir Karimov", telefon: "+998712345678", manzil: "Toshkent, Mirzo Ulugbek" },
    { nomi: "Henkel Toshkent", kontaktShaxs: "Zafar Nazarov", telefon: "+998711234567", manzil: "Toshkent, Sergeli" },
    { nomi: "Unilever distribyutor", kontaktShaxs: "Nodira Yusupova", telefon: "+998712233445", manzil: "Toshkent, Yakkasaroy" },
    { nomi: "Plastik zavod Chirchiq", kontaktShaxs: "Hamid Toshmatov", telefon: "+998903344556", manzil: "Chirchiq shahri" },
    { nomi: "Guangzhou Import", kontaktShaxs: "Li Wei", telefon: "+998712345000", manzil: "Toshkent, FEZ" },
    { nomi: "Optom Baza LLC", kontaktShaxs: "Bobur Rahimov", telefon: "+998712345678", manzil: "Toshkent, Mirzo Ulugbek" },
    { nomi: "Kimyo Zavod Angren", kontaktShaxs: "Sarvar Holmatov", telefon: "+998905566778", manzil: "Angren shahri" },
    { nomi: "Gigiena Mahsulotlari", kontaktShaxs: "Gulnora Saidova", telefon: "+998712234455", manzil: "Toshkent, Uchtepa" },
    { nomi: "Maishiy Kimyo OAJ", kontaktShaxs: "Timur Xasanov", telefon: "+998901122334", manzil: "Toshkent, Chilonzor" },
    { nomi: "Polimer Mahsulotlari", kontaktShaxs: "Sherzod Ergashev", telefon: "+998712200330", manzil: "Toshkent, Bektemir" },
    { nomi: "Russ Import Trade", kontaktShaxs: "Ivan Petrov", telefon: "+998712111222", manzil: "Toshkent, Yunusobod" },
    { nomi: "Elektr Jihozlar MChJ", kontaktShaxs: "Murod Aliyev", telefon: "+998905544332", manzil: "Toshkent, Olmazor" },
    { nomi: "Oziq-ovqat Baza", kontaktShaxs: "Feruza Nazarova", telefon: "+998712345321", manzil: "Toshkent, Shayxontohur" },
    { nomi: "Buyuk Ipak Yoli Trade", kontaktShaxs: "Otabek Mirzayev", telefon: "+998901234098", manzil: "Samarqand shahri" },
    { nomi: "Koreys Tovarlar", kontaktShaxs: "Kim Jun Ho", telefon: "+998712009988", manzil: "Toshkent, FEZ" },
  ]

  const createdTaminotchilar: any[] = []
  for (const t of taminotchilarData) {
    const tm = await prisma.taminotchi.create({ data: t })
    createdTaminotchilar.push(tm)
  }
  console.log('Taminotchilar:', createdTaminotchilar.length)

  // ==================== MIJOZLAR (50+) ====================
  const mijozlarData = [
    { ism: "Abdullayev Jasur", telefon: "+998901234567", manzil: "Toshkent, Yunusobod" },
    { ism: "Karimova Nilufar", telefon: "+998901234568", manzil: "Toshkent, Chilonzor, 19-mavze" },
    { ism: "Toshmatov Sardor", telefon: "+998901234569", manzil: "Toshkent, Mirzo Ulugbek" },
    { ism: "Xasanova Dilorom", telefon: "+998901234570", manzil: "Toshkent, Sergeli" },
    { ism: "Nazarov Bobur", telefon: "+998901234571", manzil: "Toshkent, Yakkasaroy" },
    { ism: "Yusupova Gulnora", telefon: "+998901234572", manzil: "Toshkent, Bektemir" },
    { ism: "Rahimov Sherzod", telefon: "+998901234573", manzil: "Toshkent, Olmazor" },
    { ism: "Mirzayeva Malika", telefon: "+998901234574", manzil: "Toshkent, Uchtepa" },
    { ism: "Ergashev Ulugbek", telefon: "+998901234575", manzil: "Toshkent, Shayhontohur" },
    { ism: "Saidova Mohira", telefon: "+998901234576", manzil: "Toshkent, Mirzo Ulugbek" },
    { ism: "Holmatov Firdavs", telefon: "+998901234577", manzil: "Toshkent, Yunusobod" },
    { ism: "Normatova Zulfiya", telefon: "+998901234578", manzil: "Toshkent, Chilonzor, 2-mavze" },
    { ism: "Qodirov Asilbek", telefon: "+998901234579", manzil: "Toshkent, Sergeli" },
    { ism: "Ismoilova Kamola", telefon: "+998901234580", manzil: "Toshkent, Olmazar" },
    { ism: "Tursunov Jahongir", telefon: "+998901234581", manzil: "Toshkent, Bektemir" },
    { ism: "Azimova Sevinch", telefon: "+998901234582", manzil: "Toshkent, Yakkasaroy" },
    { ism: "Hasanov Murod", telefon: "+998901234583", manzil: "Toshkent, Shayxontohur" },
    { ism: "Qosimova Nargiza", telefon: "+998901234584", manzil: "Toshkent, Mirzo Ulugbek" },
    { ism: "Sultonov Behzod", telefon: "+998901234585", manzil: "Toshkent, Yunusobod" },
    { ism: "Raximova Feruza", telefon: "+998901234586", manzil: "Toshkent, Uchtepa" },
    { ism: "Aliyev Bahodir", telefon: "+998901234587", manzil: "Toshkent, Chilonzor, 7-mavze" },
    { ism: "Mamatova Barno", telefon: "+998901234588", manzil: "Toshkent, Sergeli" },
    { ism: "Xoliqov Sanjar", telefon: "+998901234589", manzil: "Toshkent, Olmazor" },
    { ism: "Usmonova Dildora", telefon: "+998901234590", manzil: "Toshkent, Bektemir" },
    { ism: "Jurayev Akbar", telefon: "+998901234591", manzil: "Toshkent, Yunusobod" },
    { ism: "Nazarova Shahnoza", telefon: "+998901234592", manzil: "Toshkent, Yakkasaroy" },
    { ism: "Tojiboyev Mansur", telefon: "+998901234593", manzil: "Toshkent, Mirzo Ulugbek" },
    { ism: "Fayzullayeva Lola", telefon: "+998901234594", manzil: "Toshkent, Uchtepa" },
    { ism: "Xudoyberdiyev Rahim", telefon: "+998901234595", manzil: "Toshkent, Chilonzor" },
    { ism: "Abduraxmanova Ozoda", telefon: "+998901234596", manzil: "Toshkent, Shayxontohur" },
    { ism: "Iskandarov Nodir", telefon: "+998901234597", manzil: "Toshkent, Sergeli" },
    { ism: "Xoliqova Kumush", telefon: "+998901234598", manzil: "Toshkent, Bektemir" },
    { ism: "Qoraboyev Zafar", telefon: "+998901234599", manzil: "Toshkent, Olmazor" },
    { ism: "Ibragimova Maftuna", telefon: "+998901234600", manzil: "Toshkent, Yunusobod" },
    { ism: "Tursunova Nilufar", telefon: "+998901234601", manzil: "Toshkent, Yakkasaroy" },
    { ism: "Razzaqov Davron", telefon: "+998901234602", manzil: "Toshkent, Mirzo Ulugbek" },
    { ism: "Sotvoldiyeva Hamida", telefon: "+998901234603", manzil: "Toshkent, Chilonzor, 5-mavze" },
    { ism: "Xoshimov Elmurod", telefon: "+998901234604", manzil: "Toshkent, Uchtepa" },
    { ism: "Qodirov Alisher", telefon: "+998901234605", manzil: "Toshkent, Shayxontohur" },
    { ism: "Mamatqulova Iroda", telefon: "+998901234606", manzil: "Toshkent, Sergeli" },
    { ism: "Toshpulatov Sarvarbek", telefon: "+998901234607", manzil: "Toshkent, Bektemir" },
    { ism: "Yuldasheva Mavluda", telefon: "+998901234608", manzil: "Toshkent, Olmazor" },
    { ism: "Nishonov Farhod", telefon: "+998901234609", manzil: "Toshkent, Yunusobod" },
    { ism: "Sharipova Dilfuza", telefon: "+998901234610", manzil: "Toshkent, Yakkasaroy" },
    { ism: "Usmonov Mirzo", telefon: "+998901234611", manzil: "Toshkent, Mirzo Ulugbek" },
    { ism: "Xoliqov Tohir", telefon: "+998901234612", manzil: "Toshkent, Uchtepa" },
    { ism: "Qodirov Jasurbek", telefon: "+998901234613", manzil: "Toshkent, Chilonzor" },
    { ism: "Nazarova Umida", telefon: "+998901234614", manzil: "Toshkent, Shayxontohur" },
    { ism: "Salimov Behruz", telefon: "+998901234615", manzil: "Toshkent, Sergeli" },
    { ism: "Xasanova Fotima", telefon: "+998901234616", manzil: "Toshkent, Bektemir" },
  ]

  const createdMijozlar: any[] = []
  for (const m of mijozlarData) {
    const mijoz = await prisma.mijoz.create({ data: m })
    createdMijozlar.push(mijoz)
  }
  console.log('Mijozlar:', createdMijozlar.length)

  // ==================== XARAJATLAR (90 kun) ====================
  const xarajatlarData: any[] = []
  for (let i = 0; i < 90; i++) {
    const sana = daysAgo(i)
    // Oylik: ijara, kommunal (har 30 kunda)
    if (i % 30 === 0) {
      xarajatlarData.push({ kategoriya: XarajatKategoriya.IJARA, summa: 3000000, izoh: "Oylik ijara to'lovi", sana, foydalanuvchiId: admin.id })
      xarajatlarData.push({ kategoriya: XarajatKategoriya.KOMMUNAL, summa: rnd(500000, 800000), izoh: "Kommunal to'lov", sana, foydalanuvchiId: admin.id })
    }
    // Haftalik: maosh
    if (i % 7 === 0) {
      xarajatlarData.push({ kategoriya: XarajatKategoriya.MAOSH, summa: rnd(1500000, 2500000), izoh: "Xodim maoshi", sana, foydalanuvchiId: admin.id })
    }
    // Har 3-4 kunda: transport
    if (i % 3 === 0) {
      xarajatlarData.push({ kategoriya: XarajatKategoriya.TRANSPORT, summa: rnd(50000, 200000), izoh: "Transport xarajati", sana, foydalanuvchiId: rndItem(kassirlar).id })
    }
    // Boshqa (har 5 kunda)
    if (i % 5 === 0) {
      xarajatlarData.push({ kategoriya: XarajatKategoriya.BOSHQA, summa: rnd(20000, 300000), izoh: rndItem(["Ofis jihozlari", "Reklama", "Tamirlash", "Boshqa xarajat"]), sana, foydalanuvchiId: admin.id })
    }
  }
  for (const x of xarajatlarData) await prisma.xarajat.create({ data: x })
  console.log('Xarajatlar:', xarajatlarData.length)

  // ==================== SOTUVLAR (200+, 90 kun) ====================
  let sotuvCount = 0
  const allTovarlar = await prisma.tovar.findMany()

  for (let i = 0; i < 90; i++) {
    const sana = daysAgo(i)
    const kunlikSotuvSoni = rnd(2, 5)
    for (let j = 0; j < kunlikSotuvSoni; j++) {
      const kassir = rndItem(kassirlar)
      const tolovUsl = rndItem([TolovUsuli.NAQD, TolovUsuli.NAQD, TolovUsuli.NAQD, TolovUsuli.KARTA, TolovUsuli.KARTA, TolovUsuli.NASIYA])
      const mijoz = tolovUsl === TolovUsuli.NASIYA ? rndItem(createdMijozlar) : rndItem([...createdMijozlar, null, null, null])
      const chekRaqami = `CHK-${i}-${j}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      const tarkibSoni = rnd(1, 5)
      const tarkibTovarlar = [...allTovarlar].sort(() => Math.random() - 0.5).slice(0, tarkibSoni)

      let jamiSumma = 0
      const tarkiblar: any[] = []

      for (const tv of tarkibTovarlar) {
        const miqdor = rnd(1, 5)
        const narx = Number(tv.sotishNarxi)
        const jami = miqdor * narx
        jamiSumma += jami
        tarkiblar.push({ tovarId: tv.id, miqdor, birlikNarxi: narx, chegirma: 0, jami })
      }

      const sotuvSana = new Date(sana)
      sotuvSana.setHours(rnd(8, 20), rnd(0, 59))

      try {
        const sotuv = await prisma.sotuv.create({
          data: {
            chekRaqami,
            mijozId: mijoz?.id ?? null,
            jamiSumma,
            chegirma: 0,
            yakuniySumma: jamiSumma,
            tolovUsuli: tolovUsl,
            naqdTolangan: tolovUsl === TolovUsuli.NAQD ? jamiSumma : 0,
            kartaTolangan: tolovUsl === TolovUsuli.KARTA ? jamiSumma : 0,
            kassirId: kassir.id,
            sana: sotuvSana,
            tarkiblar: { create: tarkiblar }
          }
        })

        // Ombor chiqimi
        for (const t of tarkiblar) {
          await prisma.omborHarakati.create({
            data: {
              tovarId: t.tovarId,
              turi: 'CHIQIM',
              miqdor: t.miqdor,
              narx: t.birlikNarxi,
              sotuvId: sotuv.id,
              foydalanuvchiId: kassir.id,
              sana: sotuvSana,
            }
          })
        }

        // Nasiya yaratish
        if (tolovUsl === TolovUsuli.NASIYA && mijoz) {
          const muddat = new Date(sotuvSana)
          muddat.setDate(muddat.getDate() + rnd(14, 60))
          const isOtgan = muddat < new Date()
          await prisma.nasiya.create({
            data: {
              sotuvId: sotuv.id,
              mijozId: mijoz.id,
              jamiQarz: jamiSumma,
              tolangan: 0,
              qoldiq: jamiSumma,
              muddat,
              holati: isOtgan ? NasiyaHolati.MUDDATI_OTGAN : NasiyaHolati.OCHIQ,
              sana: sotuvSana,
            }
          })
        }

        sotuvCount++
      } catch (err) {
        // skip duplicates or errors
      }
    }
  }
  console.log('Sotuvlar:', sotuvCount)

  // Nasiyalarni qisman to'lash
  const nasiyalar = await prisma.nasiya.findMany({ where: { holati: { not: NasiyaHolati.YOPILGAN } } })
  for (const n of nasiyalar) {
    if (Math.random() > 0.4) {
      // 60% qisman to'langan
      const tolov = Math.round(Number(n.jamiQarz) * rnd(20, 80) / 100 / 1000) * 1000
      const newQoldiq = Number(n.jamiQarz) - tolov
      await prisma.nasiyaTolov.create({
        data: {
          nasiyaId: n.id,
          summa: tolov,
          tolovUsuli: TolovUsuli.NAQD,
          qabulQiluvchiId: rndItem(kassirlar).id,
          sana: daysAgo(rnd(0, 30)),
        }
      })
      await prisma.nasiya.update({
        where: { id: n.id },
        data: {
          tolangan: tolov,
          qoldiq: newQoldiq,
          holati: newQoldiq <= 0 ? NasiyaHolati.YOPILGAN : n.holati,
        }
      })
    }
  }
  console.log('Nasiyalar va tolovlar yaratildi')

  // ==================== XARIDLAR (ta'minotchilardan) ====================
  for (let i = 0; i < 50; i++) {
    const taminotchi = rndItem(createdTaminotchilar)
    const sana = daysAgo(rnd(0, 90))
    const tovarSoni = rnd(2, 6)
    const xaridTovarlar = [...allTovarlar].sort(() => Math.random() - 0.5).slice(0, tovarSoni)
    let jamiSumma = 0
    const tarkiblar: any[] = []
    for (const tv of xaridTovarlar) {
      const miqdor = rnd(20, 100)
      const narx = Number(tv.kelishNarxi)
      const jami = miqdor * narx
      jamiSumma += jami
      tarkiblar.push({ tovarNomi: tv.nomi, miqdor, birlikNarxi: narx, jami })
      // Ombor kirimi
      await prisma.omborHarakati.create({
        data: {
          tovarId: tv.id,
          turi: 'KIRIM',
          miqdor,
          narx,
          taminotchiId: taminotchi.id,
          foydalanuvchiId: admin.id,
          sana,
        }
      })
    }
    const tolangan = Math.random() > 0.3 ? jamiSumma : Math.round(jamiSumma * rnd(50, 90) / 100)
    await prisma.xarid.create({
      data: {
        taminotchiId: taminotchi.id,
        jamiSumma,
        tolangan,
        qoldiqQarz: jamiSumma - tolangan,
        foydalanuvchiId: admin.id,
        sana,
        tarkiblar: { create: tarkiblar },
      }
    })
  }
  console.log('Xaridlar yaratildi')

  console.log('\nSEED MUVAFFAQIYATLI YAKUNLANDI!')
  console.log('Foydalanuvchilar:')
  console.log('  admin / admin123 (Admin)')
  console.log('  kassir1 / kassir123 (Kassir)')
  console.log('  kassir2 / kassir234 (Kassir)')
  console.log('  omborchi / ombor123 (Omborchi)')
  console.log('  rahbar / rahbar123 (Admin)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
