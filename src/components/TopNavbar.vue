<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RiTvLine, RiHeartLine, RiSettings3Line } from '@remixicon/vue'

const route = useRoute()
const router = useRouter()

const navItems = computed(() => [
  { name: 'channel', label: '频道', icon: RiTvLine, path: '/' },
  { name: 'favorites', label: '收藏', icon: RiHeartLine, path: '/favorites' },
  { name: 'settings', label: '设置', icon: RiSettings3Line, path: '/settings' }
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
        <component :is="item.icon" class="nav-icon" />
        <span class="nav-label">{{ item.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped lang="scss">
.top-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 60px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  .logo {
    width: 40px;
    height: 40px;
    transition: transform var(--transition-fast);
  }
  .brand-text {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.5px;
  }
  &:hover .logo {
    transform: scale(1.05);
  }
}

.navbar-nav {
  display: flex;
  gap: 28px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  background: transparent;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
  position: relative;
  border-radius: 8px;
  cursor: pointer;
  &:hover {
    color: var(--text-primary);
    background-color: rgba(255, 255, 255, 0.03);
  }
  &.active {
    color: var(--brand-primary);
    background-color: rgba(59, 130, 246, 0.08);
    &::after {
      content: '';
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 20px;
      height: 3px;
      background-color: var(--brand-primary);
      border-radius: 2px;
    }
  }
  &:active {
    transform: scale(0.95);
  }
}

.nav-icon {
  width: 24px;
  height: 24px;
  color: inherit;
  transition: transform var(--transition-fast);
}

.nav-label {
  font-size: 13px;
  font-weight: 500;
}
</style>
