import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/global.scss'
import { initDatabase } from '@/db/database'
import { initTheme } from '@/services/theme'
import { initScheduleManager } from '@/services/schedule-manager'

const app = createApp(App)

// 初始化主题（应用用户保存的设置）
initTheme()

// 初始化数据库
initDatabase()
  .then(() => {
    console.log('数据库初始化成功')
    // 挂载应用
    app.use(createPinia())
    app.use(router)
    app.mount('#app')

    // 初始化定时更新管理器
    initScheduleManager()
  })
  .catch(err => {
    console.error('应用初始化失败:', err)
    // 降级处理：即使初始化失败也尝试挂载应用
    app.use(createPinia())
    app.use(router)
    app.mount('#app')

    // 初始化定时更新管理器
    initScheduleManager()
  })
