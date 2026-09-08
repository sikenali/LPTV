import { useApp } from '../context/AppContext'

export default function Toast() {
  const { toastMessage, toastType, settings } = useApp()
  if (!toastMessage) return null
  const isBlack = settings.theme === 'black'
  const colors = {
    success: isBlack ? 'bg-green-700' : 'bg-green-600',
    error: isBlack ? 'bg-red-700' : 'bg-red-600',
    info: isBlack ? 'bg-blue-700' : 'bg-blue-600',
  }
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg ${colors[toastType || 'success']}`}>
      {toastMessage}
    </div>
  )
}

