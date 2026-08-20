import { motion, AnimatePresence } from 'framer-motion'

export function JellyTab({
  children,
  isActive,
  onPress,
  style,
  className,
}: {
  children: React.ReactNode
  isActive?: boolean
  onPress?: () => void
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.93, rotate: isActive ? 0 : 0 }}
      whileHover={{ scale: 1.02 }}
      animate={isActive ? { scale: [1, 1.04, 0.97, 1.02, 0.98, 1] } : {}}
      transition={{ duration: 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1], ease: 'easeInOut' }}
      onClick={onPress}
      className={className}
      style={style}
      type="button"
    >
      {children}
    </motion.button>
  )
}

export function JellyIndicator({
  isActive,
  style,
  className,
}: {
  isActive: boolean
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <motion.div
      className={className}
      style={style}
      animate={isActive
        ? {
            scale: [1, 1.15, 0.9, 1.05, 0.95, 1],
            opacity: [0.7, 1],
          }
        : { scale: 1, opacity: 1 }
      }
      transition={{
        duration: 0.6,
        times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        ease: 'easeInOut',
      }}
    />
  )
}

export function SlideContent({
  show,
  children,
}: {
  show: boolean
  children: React.ReactNode
}) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
