'use client'

export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-28 lg:pb-6 transition-colors duration-200">
      {children}
    </main>
  )
}
