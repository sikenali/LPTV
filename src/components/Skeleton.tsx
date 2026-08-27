export const CHANNEL_SKELETON_COUNT = 12

export const ChannelSkeleton: React.FC<{ color: string }> = ({ color }) => (
  <div className="flex items-center gap-3 px-2 py-2.5 animate-pulse">
    <div className="w-9 h-9 rounded-full shrink-0" style={{ background: `${color}20` }} />
    <div className="flex-1 space-y-2">
      <div className="h-3 rounded w-2/3" style={{ background: `${color}15` }} />
      <div className="h-2.5 rounded w-1/2" style={{ background: `${color}10` }} />
    </div>
  </div>
)

export const ChannelListSkeleton: React.FC<{ count?: number; isBlack: boolean }> = ({ count = CHANNEL_SKELETON_COUNT, isBlack }) => (
  <div className="space-y-1">
    {Array.from({ length: count }).map((_, i) => (
      <ChannelSkeleton key={i} color={isBlack ? '#ffffff' : '#3d2b1f'} />
    ))}
  </div>
)
