/**
 * 资源缓存服务 (基于 IndexedDB)
 * 用于在浏览器本地缓存 M3U/M3U8 文件内容，实现“资源目录”功能。
 * 即使网络断开，也能读取缓存的源文件进行解析。
 */

const DB_NAME = 'LPTV_Resources'
const DB_VERSION = 1
const STORE_NAME = 'm3u_files'

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = (event: any) => resolve(event.target.result)
    request.onerror = (event: any) => reject(event.target.error)
  })
}

/**
 * 保存资源内容到本地缓存
 * @param id 资源唯一标识 (通常是 Source ID)
 * @param content 文件内容字符串
 */
export async function saveResource(id: string, content: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put({ id, content, timestamp: Date.now() })
      tx.oncomplete = () => resolve()
      tx.onerror = (e: any) => reject(e.target.error)
    })
  } catch (e) {
    console.error('保存资源缓存失败:', e)
  }
}

/**
 * 删除本地缓存的资源
 */
export async function deleteResource(id: string): Promise<void> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = (e: any) => reject(e.target.error)
    })
  } catch (e) {
    console.error('删除资源缓存失败:', e)
  }
}
/**
 * 读取本地缓存的资源内容
 */
export async function getCachedResource(id: string): Promise<string | null> {
  try {
    const db = await getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result ? request.result.content : null)
      request.onerror = (e: any) => reject(e.target.error)
    })
  } catch (e) {
    console.error('读取资源缓存失败:', e)
    return null
  }
}
