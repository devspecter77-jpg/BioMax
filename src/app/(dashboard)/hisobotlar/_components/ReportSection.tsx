'use client'
interface Props {
  sarlavha: string
  izoh?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function ReportSection({ sarlavha, izoh, actions, children }: Props) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-gray-900 dark:text-gray-100 font-semibold">{sarlavha}</h2>
          {izoh && (
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{izoh}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
