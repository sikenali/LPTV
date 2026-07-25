import { useApp } from '../context/AppContext'

export default function Toast() {
  const { toastMessage, toastType } = useApp()
  if (!toastMessage) return null
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' }
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[9999] px-5 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg ${colors[toastType || 'success']}`}>
      {toastMessage}
    </div>
  )
}
