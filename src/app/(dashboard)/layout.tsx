import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import MobileNav from '@/components/layout/MobileNav'
import MainContent from '@/components/layout/MainContent'
import { SidebarProvider } from '@/components/SidebarContext'
import DashboardContent from '@/components/layout/DashboardContent'
import LokatsiyaKuzatuv from '@/components/LokatsiyaKuzatuv'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-screen overflow-hidden bg-gray-50 dark:bg-neutral-950">
        <LokatsiyaKuzatuv />
        <Sidebar />
        <DashboardContent>
          <Header />
          <MainContent>
            {children}
          </MainContent>
          <MobileNav />
        </DashboardContent>
      </div>
    </SidebarProvider>
  )
}
