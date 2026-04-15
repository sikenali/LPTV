/**
 * 主题管理服务
 * 负责主题切换、持久化和应用
 */

type ThemeType = 'dark' | 'light' | 'blue' | 'black'

interface ThemeConfig {
  '--bg-primary': string
  '--bg-secondary': string
  '--bg-card': string
  '--border-color': string
  '--text-primary': string
  '--text-secondary': string
  '--text-disabled': string
}

const THEMES: Record<ThemeType, ThemeConfig> = {
  dark: {
    '--bg-primary': '#0f0f14',
    '--bg-secondary': '#1a1a24',
    '--bg-card': '#22222e',
    '--border-color': '#2d2d3d',
    '--text-primary': '#ffffff',
    '--text-secondary': '#8b8fa3',
    '--text-disabled': '#5a5e72'
  },
  light: {
    '--bg-primary': '#f0f2f5',
    '--bg-secondary': '#ffffff',
    '--bg-card': '#ffffff',
    '--border-color': '#c9cdd4',
    '--text-primary': '#1d2129',
    '--text-secondary': '#4e5969',
    '--text-disabled': '#86909c'
  },
  blue: {
    '--bg-primary': '#0f1a2e',
    '--bg-secondary': '#1a2a4a',
    '--bg-card': '#1e3a5f',
    '--border-color': '#2a4a6a',
    '--text-primary': '#e0f0ff',
    '--text-secondary': '#8ab4d8',
    '--text-disabled': '#5a8ab0'
  },
  black: {
    '--bg-primary': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--bg-card': '#111111',
    '--border-color': '#1a1a1a',
    '--text-primary': '#ffffff',
    '--text-secondary': '#888888',
    '--text-disabled': '#444444'
  }
}

const STORAGE_KEY = 'lptv_theme_settings'

interface ThemeSettings {
  theme: ThemeType
  accentColor: string
  fontSize: 'small' | 'medium' | 'large'
  transparentEffect: boolean
  borderRadius: number
}

const DEFAULT_SETTINGS: ThemeSettings = {
  theme: 'dark',
  accentColor: '#3b82f6',
  fontSize: 'medium',
  transparentEffect: true,
  borderRadius: 12
}

/**
 * 获取当前主题设置
 */
export function getThemeSettings(): ThemeSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }
    }
  } catch (error) {
    console.warn('读取主题设置失败:', error)
  }
  return { ...DEFAULT_SETTINGS }
}

/**
 * 保存主题设置
 */
export function saveThemeSettings(settings: Partial<ThemeSettings>): void {
  try {
    const current = getThemeSettings()
    const updated = { ...current, ...settings }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.warn('保存主题设置失败:', error)
  }
}

/**
 * 应用主题到全局 CSS 变量
 */
export function applyTheme(theme: ThemeType): void {
  const config = THEMES[theme]
  if (!config) return

  const root = document.documentElement
  Object.entries(config).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

/**
 * 应用强调色
 */
export function applyAccentColor(color: string): void {
  const root = document.documentElement
  root.style.setProperty('--brand-primary', color)
  // 计算 hover 颜色（稍微亮一点）
  const hoverColor = lightenColor(color, 10)
  root.style.setProperty('--brand-hover', hoverColor)
}

/**
 * 应用字体大小
 */
export function applyFontSize(size: 'small' | 'medium' | 'large'): void {
  const sizes = {
    small: { body: '12px', caption: '11px', subtitle: '14px', title: '20px', base: '12px' },
    medium: { body: '14px', caption: '13px', subtitle: '16px', title: '24px', base: '14px' },
    large: { body: '16px', caption: '14px', subtitle: '18px', title: '28px', base: '16px' }
  }

  const config = sizes[size]
  if (!config) return

  const root = document.documentElement
  root.style.setProperty('--font-size-body', config.body)
  root.style.setProperty('--font-size-caption', config.caption)
  root.style.setProperty('--font-size-subtitle', config.subtitle)
  root.style.setProperty('--font-size-title', config.title)
  root.style.setProperty('--font-size-base', config.base)
  root.style.fontSize = config.base
}

/**
 * 应用透明效果
 */
export function applyTransparentEffect(enabled: boolean): void {
  const root = document.documentElement
  const settings = getThemeSettings()
  
  if (enabled) {
    document.body.classList.add('transparent-effect')
    
    // 根据当前主题设置透明效果的颜色
    let bgColor: string
    let cardBgColor: string
    let sidebarBgColor: string
    let borderColor: string
    let menuHoverBgColor: string
    
    switch (settings.theme) {
      case 'light':
        bgColor = 'rgba(240, 242, 245, 0.85)'
        cardBgColor = 'rgba(255, 255, 255, 0.8)'
        sidebarBgColor = 'rgba(255, 255, 255, 0.8)'
        borderColor = 'rgba(201, 205, 212, 0.5)'
        menuHoverBgColor = 'rgba(240, 242, 245, 0.6)'
        break
      case 'blue':
        bgColor = 'rgba(15, 26, 46, 0.85)'
        cardBgColor = 'rgba(30, 42, 79, 0.8)'
        sidebarBgColor = 'rgba(26, 42, 74, 0.8)'
        borderColor = 'rgba(42, 74, 106, 0.5)'
        menuHoverBgColor = 'rgba(30, 42, 79, 0.6)'
        break
      case 'black':
        bgColor = 'rgba(0, 0, 0, 0.85)'
        cardBgColor = 'rgba(17, 17, 17, 0.8)'
        sidebarBgColor = 'rgba(10, 10, 10, 0.8)'
        borderColor = 'rgba(26, 26, 26, 0.5)'
        menuHoverBgColor = 'rgba(17, 17, 17, 0.6)'
        break
      default: // dark
        bgColor = 'rgba(15, 15, 20, 0.85)'
        cardBgColor = 'rgba(34, 34, 46, 0.8)'
        sidebarBgColor = 'rgba(26, 26, 36, 0.8)'
        borderColor = 'rgba(45, 45, 61, 0.5)'
        menuHoverBgColor = 'rgba(34, 34, 46, 0.6)'
        break
    }
    
    // 设置透明效果的颜色变量
    root.style.setProperty('--transparent-bg', bgColor)
    root.style.setProperty('--transparent-card-bg', cardBgColor)
    root.style.setProperty('--transparent-sidebar-bg', sidebarBgColor)
    root.style.setProperty('--transparent-border', borderColor)
    root.style.setProperty('--transparent-menu-hover', menuHoverBgColor)
  } else {
    document.body.classList.remove('transparent-effect')
    
    // 移除透明效果的颜色变量
    root.style.removeProperty('--transparent-bg')
    root.style.removeProperty('--transparent-card-bg')
    root.style.removeProperty('--transparent-sidebar-bg')
    root.style.removeProperty('--transparent-border')
    root.style.removeProperty('--transparent-menu-hover')
  }
}

/**
 * 应用圆角弧度
 */
export function applyBorderRadius(radius: number): void {
  const root = document.documentElement
  root.style.setProperty('--border-radius-sm', `${Math.max(2, Math.floor(radius * 0.5))}px`)
  root.style.setProperty('--border-radius-md', `${radius}px`)
  root.style.setProperty('--border-radius-lg', `${Math.min(24, Math.ceil(radius * 1.5))}px`)
  root.style.setProperty('--border-radius-xl', `${Math.min(32, radius * 2)}px`)
}

/**
 * 初始化主题（应用保存的设置）
 */
export function initTheme(): void {
  const settings = getThemeSettings()
  applyTheme(settings.theme)
  applyAccentColor(settings.accentColor)
  applyFontSize(settings.fontSize)
  applyTransparentEffect(settings.transparentEffect)
  applyBorderRadius(settings.borderRadius)
}

/**
 * 切换主题
 */
export function switchTheme(theme: ThemeType): void {
  applyTheme(theme)
  saveThemeSettings({ theme })
  
  // 切换主题后，重新应用透明效果，确保颜色与当前主题匹配
  const settings = getThemeSettings()
  applyTransparentEffect(settings.transparentEffect)
}

/**
 * 切换强调色
 */
export function switchAccentColor(color: string): void {
  applyAccentColor(color)
  saveThemeSettings({ accentColor: color })
}

/**
 * 切换字体大小
 */
export function switchFontSize(size: 'small' | 'medium' | 'large'): void {
  applyFontSize(size)
  saveThemeSettings({ fontSize: size })
}

/**
 * 切换透明效果
 */
export function switchTransparentEffect(enabled: boolean): void {
  applyTransparentEffect(enabled)
  saveThemeSettings({ transparentEffect: enabled })
}

/**
 * 切换圆角弧度
 */
export function switchBorderRadius(radius: number): void {
  applyBorderRadius(radius)
  saveThemeSettings({ borderRadius: radius })
}

/**
 * 简单的颜色变亮函数
 */
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, (num >> 16) + percent)
  const g = Math.min(255, ((num >> 8) & 0x00ff) + percent)
  const b = Math.min(255, (num & 0x0000ff) + percent)
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`
}
