export type Theme = 'glass' | 'black';

export function getBgClass(theme: Theme): string {
  return theme === 'black' ? 'bg-[#0a0a0a]' : 'bg-[#fbf7f0]';
}

export function getPanelClass(theme: Theme): string {
  return theme === 'black' ? 'bg-[#1a1a1a]' : 'bg-[#f8f3e8]';
}

export function getTextClass(theme: Theme): string {
  return theme === 'black' ? 'text-white' : 'text-[#3d2b1f]';
}

export function getTextSecondaryClass(theme: Theme): string {
  return theme === 'black' ? 'text-white/50' : 'text-[#8b7e6a]';
}

export function getBorderClass(theme: Theme): string {
  return theme === 'black' ? 'border-white/10' : 'border-[#e5d9c4]';
}

export function getSearchContainerClass(theme: Theme): string {
  return theme === 'black' ? 'bg-[#0a0a0a]' : 'bg-[#fbf7f0]';
}

export function getChannelItemSelectedClass(isSelected: boolean, theme: Theme): string {
  if (isSelected) return theme === 'black' ? 'bg-white/10' : 'bg-[#fdfaf4]';
  return '';
}

export function getHoverClass(theme: Theme): string {
  return theme === 'black' ? 'hover:bg-white/5' : 'hover:bg-[#fdfaf4]';
}

export function getLogoBgClass(theme: Theme): string {
  return theme === 'black' ? 'bg-[#2a2a2a]' : 'bg-[#f0e8d8]';
}

export function getHeartIconClass(theme: Theme): string {
  return theme === 'black' ? 'text-white/40' : 'text-[#8b7e6a]';
}

export function getInputTextClass(theme: Theme): string {
  return theme === 'black' ? 'text-white placeholder-white/30' : 'text-[#3d2b1f] placeholder-[#b8a88a]';
}
