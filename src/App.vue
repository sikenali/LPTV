<script setup lang="ts">
import TopNavbar from '@/components/TopNavbar.vue'
</script>

<template>
  <div class="app">
    <TopNavbar />
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
</template>

<style scoped lang="scss">
.app {
  min-height: 100vh;
  background-color: var(--bg-primary);
}

.app-main {
  height: 100vh;
  overflow: hidden;
}
</style>
