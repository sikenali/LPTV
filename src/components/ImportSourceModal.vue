<script setup lang="ts">
import { ref, computed } from 'vue'
const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: []; import: [data: { name: string; url: string; type: 'url' | 'file' }] }>()
const activeTab = ref<'url' | 'file'>('url')
const sourceName = ref('')
const sourceUrl = ref('')
const selectedFile = ref<File | null>(null)
const isVisible = computed(() => props.visible)
const handleClose = () => { emit('close'); resetForm() }
const handleImport = () => {
  if (activeTab.value === 'url' && sourceUrl.value) {
    emit('import', { name: sourceName.value || sourceUrl.value.split('/').pop() || '未命名', url: sourceUrl.value, type: 'url' })
    handleClose()
  }
}
const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) { selectedFile.value = target.files[0]; sourceName.value = selectedFile.value.name.replace(/\.(m3u|m3u8)$/, '') }
}
const resetForm = () => { sourceName.value = ''; sourceUrl.value = ''; selectedFile.value = null; activeTab.value = 'url' }
</script>

<template>
  <Teleport to="body">
    <div v-if="isVisible" class="modal-overlay" @click.self="handleClose">
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">导入直播源</h3>
          <button class="modal-close" @click="handleClose">×</button>
        </div>
        <div class="modal-tabs">
          <button class="tab" :class="{ active: activeTab === 'url' }" @click="activeTab = 'url'">URL 地址</button>
          <button class="tab" :class="{ active: activeTab === 'file' }" @click="activeTab = 'file'">本地文件</button>
        </div>
        <div class="modal-body">
          <div v-if="activeTab === 'url'" class="tab-content">
            <div class="form-group"><label>源名称（可选）</label><input v-model="sourceName" type="text" placeholder="请输入源名称，默认使用文件名" /></div>
            <div class="form-group"><label>直播源地址</label><input v-model="sourceUrl" type="text" placeholder="请输入 m3u/m3u8 地址" /></div>
          </div>
          <div v-else class="tab-content">
            <div class="file-drop">
              <input type="file" accept=".m3u,.m3u8" @change="handleFileSelect" class="file-input" />
              <div class="file-drop-content">
                <div class="file-icon">📁</div><div class="file-text">拖拽文件到此处 或 点击选择</div><div class="file-hint">.m3u, .m3u8</div>
              </div>
              <div v-if="selectedFile" class="selected-file">已选择: {{ selectedFile.name }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose">取消</button>
          <button class="btn btn-primary" @click="handleImport">导入</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
.modal { background-color: var(--bg-card); border-radius: var(--radius-md); width: 500px; max-width: 90vw; box-shadow: var(--shadow-modal); }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: var(--spacing-lg); border-bottom: 1px solid var(--border-color); .modal-title { font-size: var(--font-size-subtitle); font-weight: 600; } .modal-close { background: transparent; font-size: 24px; color: var(--text-secondary); &:hover { color: var(--text-primary); } } }
.modal-tabs { display: flex; border-bottom: 1px solid var(--border-color); .tab { flex: 1; padding: var(--spacing-md); background: transparent; color: var(--text-secondary); transition: color var(--transition-fast); &.active { color: var(--brand-primary); border-bottom: 2px solid var(--brand-primary); } } }
.modal-body { padding: var(--spacing-lg); }
.form-group { margin-bottom: var(--spacing-md); label { display: block; font-size: var(--font-size-caption); color: var(--text-secondary); margin-bottom: var(--spacing-xs); } input { width: 100%; padding: var(--spacing-md); background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm); color: var(--text-primary); &:focus { border-color: var(--brand-primary); } } }
.file-drop { border: 2px dashed var(--border-color); border-radius: var(--radius-md); padding: var(--spacing-xl); text-align: center; position: relative; .file-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; } .file-icon { font-size: 48px; margin-bottom: var(--spacing-md); } .file-text { font-size: var(--font-size-body); color: var(--text-secondary); margin-bottom: var(--spacing-sm); } .file-hint { font-size: var(--font-size-caption); color: var(--text-disabled); } .selected-file { margin-top: var(--spacing-md); font-size: var(--font-size-caption); color: var(--success); } }
.modal-footer { display: flex; justify-content: flex-end; gap: var(--spacing-md); padding: var(--spacing-lg); border-top: 1px solid var(--border-color); .btn { padding: var(--spacing-md) var(--spacing-xl); border-radius: var(--radius-sm); &.btn-primary { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); } } &.btn-secondary { background-color: var(--bg-secondary); color: var(--text-secondary); &:hover { color: var(--text-primary); } } } }
</style>
