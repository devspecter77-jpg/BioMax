'use client'

export default function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="asosiy"
      // Skip link shu yerga sakraydi; tabIndex={-1} busiz fokus tushmaydi
      tabIndex={-1}
      className="flex-1 overflow-y-auto p-4 lg:p-6 pb-28 lg:pb-6 transition-colors duration-200 focus:outline-none"
    >
      {children}
    </main>
  )
}
