import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './styles/global.scss'
import { initDatabase } from '@/db/database'
import { initializeDefaultSources } from '@/services/source-loader'
import { initTheme } from '@/services/theme'

const app = createApp(App)

// 初始化主题（应用用户保存的设置）
initTheme()

// 初始化数据库并导入默认源
// 必须在源数据导入完成后再挂载应用，否则频道列表会读到空数据
initDatabase()
  .then(() => {
    console.log('数据库初始化成功')
    return initializeDefaultSources()
  })
  .then(() => {
    console.log('默认直播源初始化完成')
    // 数据就绪，挂载应用
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  })
  .catch(err => {
    console.error('应用初始化失败:', err)
    // 降级处理：即使初始化失败也尝试挂载应用
    app.use(createPinia())
    app.use(router)
    app.mount('#app')
  })
