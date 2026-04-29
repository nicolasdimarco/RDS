import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  open, title, onClose, children, footer, wide,
}: {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} flex flex-col max-h-[92vh]`}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
