export const BASE_URL = 'https://iptv345.com';
export const TOKEN = '096084226df84fa64f443317d448b36b';

export const getPlayUrl = (tid: string, channelId: string): string => {
  return `${BASE_URL}/?act=play&token=${TOKEN}&tid=${tid}&id=${channelId}`;
};