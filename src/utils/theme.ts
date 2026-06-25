export type Theme = 'glass' | 'white' | 'black';

export function getBgClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'bg-gray-50';
    case 'black': return 'bg-gray-900';
    case 'glass': return 'bg-gradient-to-br from-gray-100 via-blue-50 to-purple-50';
  }
}

export function getPanelClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'bg-white border-gray-200';
    case 'black': return 'bg-gray-800 border-gray-700';
    case 'glass': return 'bg-white/80 backdrop-blur-lg border-gray-200/50';
  }
}

export function getCardClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'bg-white border-gray-200';
    case 'black': return 'bg-gray-800 border-gray-700';
    case 'glass': return 'bg-white/70 backdrop-blur-xl border-white/20';
  }
}

export function getTextClass(theme: Theme): string {
  switch (theme) {
    case 'white':
    case 'glass':
      return 'text-gray-800';
    case 'black':
      return 'text-white';
  }
}

export function getTextSecondaryClass(theme: Theme): string {
  switch (theme) {
    case 'white':
    case 'glass':
      return 'text-gray-500';
    case 'black':
      return 'text-gray-400';
  }
}

export function getInputClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'bg-gray-50 border-gray-200 text-gray-800 placeholder:text-gray-400';
    case 'black': return 'bg-gray-700 border-gray-600 text-white placeholder:text-gray-400';
    case 'glass': return 'bg-white/60 border-gray-200/50 text-gray-800 placeholder:text-gray-400';
  }
}

export function getSearchContainerClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'bg-gray-100 border-[#E8E8E8]';
    case 'black': return 'bg-gray-700 border-gray-600';
    case 'glass': return 'bg-white/60 border-gray-200/50';
  }
}

export function getSidebarMenuItemClass(theme: Theme, isActive: boolean): string {
  switch (theme) {
    case 'black':
      return isActive
        ? 'bg-gray-700 text-blue-400 border-l-[3px] border-blue-500'
        : 'text-gray-400 hover:bg-gray-700 border-l-[3px] border-transparent';
    case 'glass':
      return isActive
        ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600'
        : 'text-slate-500 hover:bg-white/50 border-l-[3px] border-transparent';
    case 'white':
      return isActive
        ? 'bg-blue-50 text-blue-600 border-l-[3px] border-blue-600'
        : 'text-slate-500 hover:bg-gray-50 border-l-[3px] border-transparent';
  }
}

export function getCategoryHeaderClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'bg-gray-50';
    case 'black': return 'bg-gray-700';
    case 'glass': return 'bg-white/60';
  }
}

export function getHoverClass(theme: Theme): string {
  switch (theme) {
    case 'white': return 'hover:bg-gray-50';
    case 'black': return 'hover:bg-gray-700';
    case 'glass': return 'hover:bg-white/50';
  }
}

export function getChannelItemSelectedClass(isSelected: boolean, theme: Theme): string {
  switch (theme) {
    case 'black':
      return isSelected
        ? 'bg-gray-700 border-l-[3px] border-blue-500'
        : 'hover:bg-gray-700 border-l-[3px] border-transparent';
    case 'glass':
      return isSelected
        ? 'bg-blue-50 border-l-[3px] border-blue-600'
        : 'hover:bg-white/50 border-l-[3px] border-transparent';
    case 'white':
      return isSelected
        ? 'bg-blue-50 border-l-[3px] border-blue-600'
        : 'hover:bg-gray-50 border-l-[3px] border-transparent';
  }
}