export const IPTV345_TOKEN = '79e9e4ac43fa67c36a3236b7ae8a2027'

export function getIptvUrlsUrl(tid: string, id: string): string {
  return `/api/iptv/urls/${tid}/${id}`
}

export function getIptvProxyUrl(tid: string, id: string): string {
  return `/api/proxy/iptv/${tid}/${id}`
}
