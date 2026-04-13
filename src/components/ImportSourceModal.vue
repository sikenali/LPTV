<script setup lang="ts">
import { ref, computed } from 'vue'
import { RiFolderLine } from '@remixicon/vue'

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
                <RiFolderLine class="file-icon" />
                <div class="file-text">拖拽文件到此处 或 点击选择</div>
                <div class="file-hint">.m3u, .m3u8</div>
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
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.modal {
  background-color: var(--bg-card);
  border-radius: 16px;
  width: 520px;
  max-width: 90vw;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--border-color);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
  .modal-title { font-size: 17px; font-weight: 600; }
  .modal-close {
    background: transparent;
    font-size: 22px;
    color: var(--text-secondary);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: all var(--transition-fast);
    &:hover { color: var(--text-primary); background-color: var(--bg-secondary); }
  }
}

.modal-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  padding: 0 24px;
  .tab {
    flex: 1;
    padding: 14px 16px;
    background: transparent;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-fast);
    border-bottom: 2px solid transparent;
    &.active { color: var(--brand-primary); border-bottom-color: var(--brand-primary); }
    &:hover:not(.active) { color: var(--text-primary); }
  }
}

.modal-body { padding: 24px; }

.form-group {
  margin-bottom: 16px;
  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 6px;
  }
  input {
    width: 100%;
    padding: 12px 14px;
    background-color: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 14px;
    transition: all var(--transition-fast);
    &:focus { border-color: var(--brand-primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15); outline: none; }
    &::placeholder { color: var(--text-disabled); }
  }
}

.file-drop {
  border: 2px dashed var(--border-color);
  border-radius: 12px;
  padding: 40px 24px;
  text-align: center;
  position: relative;
  transition: all var(--transition-fast);
  &:hover { border-color: var(--brand-primary); background-color: rgba(59, 130, 246, 0.04); }
  .file-input { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
  .file-icon { width: 40px; height: 40px; margin-bottom: 12px; color: var(--text-secondary); opacity: 0.6; }
  .file-text { font-size: 14px; color: var(--text-secondary); margin-bottom: 6px; }
  .file-hint { font-size: 12px; color: var(--text-disabled); }
  .selected-file { margin-top: 12px; font-size: 13px; color: var(--success); font-weight: 500; }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 20px 24px;
  border-top: 1px solid var(--border-color);
  .btn {
    padding: 10px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    transition: all var(--transition-fast);
    &.btn-primary { background-color: var(--brand-primary); color: white; &:hover { background-color: var(--brand-hover); } }
    &.btn-secondary { background-color: var(--bg-secondary); color: var(--text-secondary); &:hover { color: var(--text-primary); background-color: var(--bg-card); } }
  }
}
</style>
