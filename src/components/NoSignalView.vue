<script setup lang="ts">
import { RiSignalWifiOffLine, RiTimeLine } from '@remixicon/vue'

interface Props {
  message?: string
  checkMessage?: string
  estimatedTime?: string
}

withDefaults(defineProps<Props>(), {
  message: '当前频道无信号',
  checkMessage: '请检查信号源连接或切换至其他频道',
  estimatedTime: '预计信号恢复时间：08:00 - 09:30'
})
</script>

<template>
  <div class="no-signal-view">
    <!-- 背景网格容器 -->
    <div class="background-grid">
      <!-- 灰色网格背景 -->
      <div class="grid-background"></div>

      <!-- 左侧彩色竖条 -->
      <div class="color-bars left-color-bars">
        <div class="color-bar cyan-bar"></div>
        <div class="color-bar magenta-bar"></div>
        <div class="color-bar brown-bar"></div>
      </div>

      <!-- 右侧彩色竖条 -->
      <div class="color-bars right-color-bars">
        <div class="color-bar blue-bar"></div>
        <div class="color-bar green-bar"></div>
        <div class="color-bar purple-bar"></div>
        <div class="color-bar brown-bar"></div>
      </div>

      <!-- 测试卡容器 -->
      <div class="test-card">
        <!-- 顶部白色区域 -->
        <div class="test-card-top">
          <div class="black-block top-left"></div>
          <div class="black-block top-right"></div>
          <div class="black-bar top-bar"></div>
        </div>

        <!-- 黑白灰条纹容器 -->
        <div class="bw-stripes">
          <div v-for="i in 12" :key="'bw-' + i" class="bw-stripe"></div>
        </div>

        <!-- 彩色条容器 -->
        <div class="color-stripes">
          <div class="color-stripe yellow-stripe"></div>
          <div class="color-stripe cyan-stripe"></div>
          <div class="color-stripe green-stripe"></div>
          <div class="color-stripe purple-stripe"></div>
          <div class="color-stripe red-stripe"></div>
          <div class="color-stripe blue-stripe"></div>
        </div>

        <!-- 黑色网格容器 -->
        <div class="black-grid">
          <div class="grid-row">
            <div v-for="i in 12" :key="'grid1-' + i" class="grid-cell"></div>
          </div>
          <div class="grid-row">
            <div v-for="i in 12" :key="'grid2-' + i" class="grid-cell"></div>
          </div>
        </div>

        <!-- 竖线测试容器 -->
        <div class="vertical-lines">
          <div class="left-black-edge"></div>
          <div class="thick-lines">
            <div v-for="i in 11" :key="'thick-' + i" class="thick-line"></div>
          </div>
          <div class="center-cross"></div>
          <div class="thin-lines">
            <div v-for="i in 27" :key="'thin-' + i" class="thin-line"></div>
          </div>
          <div class="right-gray-block"></div>
          <div class="right-black-edge"></div>
        </div>

        <!-- 灰度条容器 -->
        <div class="gray-stripes">
          <div class="gray-stripe" style="background-color: rgba(0, 0, 0, 1);"></div>
          <div class="gray-stripe" style="background-color: rgba(51, 51, 51, 1);"></div>
          <div class="gray-stripe" style="background-color: rgba(102, 102, 102, 1);"></div>
          <div class="gray-stripe" style="background-color: rgba(153, 153, 153, 1);"></div>
          <div class="gray-stripe" style="background-color: rgba(204, 204, 204, 1);"></div>
          <div class="gray-stripe" style="background-color: rgba(255, 255, 255, 1);"></div>
        </div>

        <!-- 底部白色区域 -->
        <div class="bottom-white">
          <div class="black-bar bottom-black-bar"></div>
        </div>

        <!-- 底部黄色区域 -->
        <div class="bottom-yellow">
          <div class="red-block"></div>
        </div>
      </div>
    </div>

    <!-- 底部提示栏 -->
    <div class="bottom-notice">
      <span class="notice-text">{{ message }}</span>
    </div>

    <!-- 附加信息区域 -->
    <div class="additional-info">
      <div class="info-item">
        <RiSignalWifiOffLine class="info-icon warning-icon" />
        <span class="info-text">{{ checkMessage }}</span>
      </div>
      <div class="info-item">
        <RiTimeLine class="info-icon time-icon" />
        <span class="info-text">{{ estimatedTime }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.no-signal-view {
  width: 100%;
  height: 100%;
  background-color: rgba(128, 128, 128, 1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 背景网格容器 */
.background-grid {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.grid-background {
  position: absolute;
  inset: 0;
  background-color: rgba(128, 128, 128, 1);
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* 彩色竖条 */
.color-bars {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 8%;
  max-width: 80px;
  height: 80%;
  display: flex;
  flex-direction: column;
}

.left-color-bars {
  left: 20%;
}

.right-color-bars {
  right: 20%;
}

.color-bar {
  width: 100%;
  flex: 1;
}

.cyan-bar {
  flex: 2;
  background-color: rgba(0, 224, 199, 1);
}

.magenta-bar {
  flex: 2;
  background-color: rgba(216, 58, 128, 1);
}

.brown-bar {
  flex: 1;
  background-color: rgba(196, 98, 16, 1);
}

.blue-bar {
  flex: 1;
  background-color: rgba(99, 155, 255, 1);
}

.green-bar {
  flex: 2;
  background-color: rgba(101, 155, 56, 1);
}

.purple-bar {
  flex: 1;
  background-color: rgba(99, 99, 255, 1);
}

/* 测试卡容器 */
.test-card {
  position: relative;
  width: 60%;
  max-width: 800px;
  aspect-ratio: 1 / 1;
  max-height: 90%;
  border-radius: 9999px;
  border: 0.5vw;
  border-style: solid;
  border-color: rgba(255, 255, 255, 1);
  overflow: hidden;
  background-color: rgba(255, 255, 255, 1);
  display: flex;
  flex-direction: column;
}

.test-card-top {
  width: 100%;
  height: 20%;
  max-height: 160px;
  background-color: rgba(255, 255, 255, 1);
  position: relative;

  .black-block {
    position: absolute;
    width: 10%;
    max-width: 81px;
    height: 25%;
    max-height: 40px;
    background-color: rgba(0, 0, 0, 1);
    bottom: 12.5%;

    &.top-left {
      left: -0.5px;
    }

    &.top-right {
      right: -0.5px;
    }
  }

  .top-bar {
    position: absolute;
    width: 34%;
    max-width: 274px;
    height: 37.5%;
    max-height: 60px;
    background-color: rgba(0, 0, 0, 1);
    top: 31.25%;
    left: 33%;
  }
}

.bw-stripes {
  width: 100%;
  height: 5%;
  max-height: 40px;
  display: flex;
}

.bw-stripe {
  flex: 1;
  height: 100%;

  &:nth-child(odd) {
    background-color: rgba(0, 0, 0, 1);
  }
  &:nth-child(even) {
    background-color: rgba(179, 179, 179, 1);
  }
}

.color-stripes {
  width: 100%;
  height: 15%;
  max-height: 120px;
  display: flex;
}

.color-stripe {
  flex: 1;
  height: 100%;

  &.yellow-stripe { background-color: rgba(240, 230, 55, 1); }
  &.cyan-stripe { background-color: rgba(0, 255, 255, 1); }
  &.green-stripe { background-color: rgba(0, 255, 0, 1); }
  &.purple-stripe { background-color: rgba(255, 0, 255, 1); }
  &.red-stripe { background-color: rgba(255, 0, 0, 1); }
  &.blue-stripe { background-color: rgba(0, 0, 255, 1); }
}

.black-grid {
  width: 100%;
  height: 10%;
  max-height: 80px;
}

.grid-row {
  width: 100%;
  height: 50%;
  display: flex;
}

.grid-cell {
  flex: 1;
  height: 100%;
  background-color: rgba(0, 0, 0, 1);
}

.vertical-lines {
  width: 100%;
  height: 20%;
  max-height: 160px;
  display: flex;
  align-items: center;
}

.left-black-edge {
  width: 5%;
  max-width: 41px;
  height: 100%;
  background-color: rgba(0, 0, 0, 1);
}

.thick-lines {
  width: 27.5%;
  max-width: 220px;
  height: 100%;
  display: flex;
}

.thick-line {
  width: 10%;
  max-width: 21px;
  height: 100%;

  &:nth-child(odd) {
    background-color: rgba(255, 255, 255, 1);
  }
  &:nth-child(even) {
    background-color: rgba(0, 0, 0, 1);
  }
}

.center-cross {
  width: 10%;
  max-width: 81px;
  height: 100%;
  background-color: rgba(0, 0, 0, 1);
}

.thin-lines {
  width: 27.5%;
  max-width: 220px;
  height: 100%;
  display: flex;
}

.thin-line {
  width: 4.5%;
  max-width: 9px;
  height: 100%;

  &:nth-child(odd) {
    background-color: rgba(255, 255, 255, 1);
  }
  &:nth-child(even) {
    background-color: rgba(0, 0, 0, 1);
  }
}

.right-gray-block {
  width: 12.5%;
  max-width: 101px;
  height: 100%;
  background-color: rgba(179, 179, 179, 1);
}

.right-black-edge {
  width: 5%;
  max-width: 41px;
  height: 100%;
  background-color: rgba(0, 0, 0, 1);
}

.gray-stripes {
  width: 100%;
  height: 7.5%;
  max-height: 60px;
  display: flex;
}

.gray-stripe {
  flex: 1;
  height: 100%;
}

.bottom-white {
  width: 100%;
  height: 10%;
  max-height: 80px;
  background-color: rgba(255, 255, 255, 1);
  position: relative;

  .bottom-black-bar {
    position: absolute;
    width: 60%;
    max-width: 482px;
    height: 75%;
    max-height: 60px;
    background-color: rgba(0, 0, 0, 1);
    top: 12.5%;
    left: 18.5%;
  }
}

.bottom-yellow {
  width: 100%;
  height: 7.5%;
  max-height: 60px;
  background-color: rgba(240, 230, 55, 1);
  display: flex;
  align-items: center;
  justify-content: center;

  .red-block {
    width: 7.5%;
    max-width: 61px;
    height: 100%;
    background-color: rgba(255, 0, 0, 1);
  }
}

/* 底部提示栏 */
.bottom-notice {
  width: 100%;
  padding: 2% 0;
  background-color: rgba(0, 0, 0, 1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.notice-text {
  font-size: clamp(14px, 2vw, 28px);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(255, 255, 255, 1);
}

/* 附加信息区域 */
.additional-info {
  width: 100%;
  background-color: rgba(26, 26, 26, 1);
  padding: clamp(8px, 2vh, 32px) clamp(12px, 3vw, 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(4px, 1vh, 16px);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-icon {
  width: clamp(16px, 2vw, 26px);
  height: clamp(16px, 2vw, 26px);
  flex-shrink: 0;
}

.warning-icon {
  color: rgba(99, 155, 255, 1);
}

.time-icon {
  color: rgba(101, 155, 56, 1);
}

.info-text {
  font-size: clamp(12px, 1.5vw, 18px);
  font-family: 'SourceHanSans-Medium', sans-serif;
  color: rgba(204, 204, 204, 1);
}

.additional-info .info-item:last-child .info-text {
  font-size: clamp(11px, 1.2vw, 16px);
  color: rgba(153, 153, 153, 1);
}
</style>
