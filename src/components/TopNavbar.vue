<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
const navItems = computed(() => [
  { name: 'channel', label: '频道', icon: '📺', path: '/' },
  { name: 'favorites', label: '收藏', icon: '❤️', path: '/favorites' },
  { name: 'settings', label: '设置', icon: '⚙️', path: '/settings' }
])
const isActive = (name: string) => route.name === name
const navigate = (path: string) => router.push(path)
</script>

<template>
  <nav class="top-navbar">
    <div class="navbar-brand">
      <img src="/logo.svg" alt="LPTV Logo" class="logo" />
      <span class="brand-text">LPTV</span>
    </div>
    <div class="navbar-nav">
      <button v-for="item in navItems" :key="item.name" class="nav-item" :class="{ active: isActive(item.name) }" @click="navigate(item.path)">
        <span class="nav-icon">{{ item.icon }}</span>
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.top-navbar {
  position: fixed; top: 0; left: 0; right: 0; height: 80px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 80px; background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color); z-index: 1000;
}
.navbar-brand { display: flex; align-items: center; gap: var(--spacing-md);
  .logo { width: 40px; height: 40px; }
  .brand-text { font-size: 24px; font-weight: bold; color: var(--text-primary); }
}
.navbar-nav { display: flex; gap: 32px; }
.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 8px 16px; background: transparent;
  color: var(--text-secondary); transition: color var(--transition-fast); position: relative;
  border-radius: 8px; cursor: pointer;
  &:hover { color: var(--text-primary); }
  &.active { color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.1);
    &::after { content: ''; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); width: 24px; height: 3px; background-color: var(--brand-primary); border-radius: 2px; }
  }
  .nav-icon { font-size: 24px; }
  .nav-label { font-size: 13px; }
}
</style>
