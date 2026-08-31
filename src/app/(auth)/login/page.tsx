import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  let dokonNomi = 'BioMax'
  try {
    const sozlama = await prisma.sozlama.findUnique({ where: { kalit: 'dokon_nomi' } })
    if (sozlama?.qiymat) dokonNomi = sozlama.qiymat
  } catch {
    // DB xatosi bo'lsa standart nom ishlatiladi
  }

  // "BioMax" — brend nomi uchun ikki rangli yozuv (Bio quyuq/oq, Max qizil).
  // Boshqa do'kon nomi kiritilgan bo'lsa, bitta rangda ko'rsatiladi.
  const ikkiRangli = dokonNomi.trim().toLowerCase() === 'biomax'

  return (
    <div className="min-h-screen flex relative overflow-hidden">

      {/* Chap panel — brending */}
      <div className="hidden lg:flex lg:w-[43%] bg-gradient-to-br from-[#EF4444] to-[#B91C1C] flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background dekor */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 rounded-full" />
          <div className="absolute -bottom-32 -right-16 w-[500px] h-[500px] bg-black/15 rounded-full" />
          <div
            className="absolute bottom-0 left-0 w-72 h-72 opacity-30"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1.5px, transparent 1.5px)',
              backgroundSize: '16px 16px',
              maskImage: 'radial-gradient(circle at bottom left, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at bottom left, black 0%, transparent 70%)',
            }}
          />
        </div>
        {/* Kontent */}
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center mb-8 w-20 h-20 rounded-2xl bg-white shadow-lg shadow-black/20 overflow-hidden p-1.5">
            <Image src="/maxbio-icon.png" alt="BioMax" width={80} height={80} className="w-full h-full object-contain" priority />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">{dokonNomi}</h1>
          <p className="text-white/80 text-base leading-relaxed max-w-xs mx-auto font-mono">
            Do&apos;kon boshqaruv tizimi — sotuv, ombor, hisobot
          </p>
          <div className="mt-10 flex flex-col gap-3 text-left">
            {[
              'Sotuv va kassa boshqaruvi',
              'Ombor va tovar hisobi',
              'Moliyaviy hisobotlar',
            ].map((t) => (
              <div key={t} className="flex items-center gap-3 text-white text-sm">
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* O'ng panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 relative overflow-hidden">
        <div
          className="hidden lg:block absolute top-0 right-0 w-80 h-80 opacity-40 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(220,38,38,0.35) 1.5px, transparent 1.5px)',
            backgroundSize: '18px 18px',
            maskImage: 'radial-gradient(circle at top right, black 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle at top right, black 0%, transparent 70%)',
          }}
        />

        {/* Mobil brend sarlavhasi — lg:hidden panel o'rniga ixcham logo */}
        <div className="lg:hidden flex flex-col items-center mb-8 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md shadow-black/10 mb-3 overflow-hidden p-1">
            <Image src="/maxbio-icon.png" alt="BioMax" width={56} height={56} className="w-full h-full object-contain" priority />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {ikkiRangli ? (
              <>
                <span>Bio</span>
                <span className="text-primary">Max</span>
              </>
            ) : dokonNomi}
          </h1>
          <p className="text-gray-400 text-xs font-mono mt-1">Do&apos;kon boshqaruv tizimi</p>
        </div>

        <div className="w-full max-w-[380px] relative z-10">
          <LoginForm />
        </div>

        <p className="mt-8 text-gray-400 text-xs font-mono relative z-10">
          © {new Date().getFullYear()} {dokonNomi}
        </p>
      </div>

      {/* Butun sahifa bo'ylab pastki to'lqin */}
      <svg
        className="absolute bottom-0 left-0 w-full pointer-events-none"
        style={{ height: '9%' }}
        viewBox="0 0 1600 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M0,90 C300,10 700,150 1050,70 C1300,10 1450,90 1600,40 L1600,160 L0,160 Z" fill="white" />
      </svg>
    </div>
  )
}
