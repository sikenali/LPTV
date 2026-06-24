import { ChannelLine, Channel } from '../types';

const BASE_URL = 'https://iptv345.com';
const TOKEN = '096084226df84fa64f443317d448b36b';

export const fetchVideoUrl = async (tid: string, channelId: string, lineId?: string): Promise<string> => {
  const url = new URL(`${BASE_URL}/?act=play`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('tid', tid);
  url.searchParams.set('id', channelId);
  if (lineId) url.searchParams.set('line', lineId);

  const response = await fetch(url.toString());
  const html = await response.text();
  
  const videoMatch = html.match(/<video[^>]+src="([^"]+)"/);
  if (videoMatch && videoMatch[1]) {
    return videoMatch[1];
  }
  
  throw new Error('无法获取视频流');
};

export const parseChannelLines = (html: string): ChannelLine[] => {
  const lines: ChannelLine[] = [];
  const linePattern = /data-line="(\d+)"[^>]*>([^<]+)/g;
  let match;
  
  while ((match = linePattern.exec(html)) !== null) {
    lines.push({
      id: match[1],
      name: match[2].trim(),
      url: '',
      quality: '',
      isActive: false
    });
  }
  
  return lines.length > 0 ? lines : [
    { id: '1', name: '默认线路', url: '', quality: '高清', isActive: true }
  ];
};

export const fetchChannelLines = async (tid: string, channelId: string): Promise<ChannelLine[]> => {
  const url = new URL(`${BASE_URL}/?act=play`);
  url.searchParams.set('token', TOKEN);
  url.searchParams.set('tid', tid);
  url.searchParams.set('id', channelId);

  const response = await fetch(url.toString());
  const html = await response.text();
  
  return parseChannelLines(html);
};

export interface ParsedChannel {
  id: string;
  name: string;
  logo: string;
  currentProgram: string;
  isLive: boolean;
}

export const parseChannelList = (html: string): ParsedChannel[] => {
  const channels: ParsedChannel[] = [];
  
  const listPattern = /<div[^>]+class="channel-item"[^>]*>[\s\S]*?<\/div>/g;
  let match;
  
  while ((match = listPattern.exec(html)) !== null) {
    const itemHtml = match[0];
    
    const idMatch = itemHtml.match(/data-id="([^"]+)"/);
    const nameMatch = itemHtml.match(/<span[^>]*class="channel-name"[^>]*>([^<]+)<\/span>/);
    const programMatch = itemHtml.match(/<span[^>]*class="program-name"[^>]*>([^<]+)<\/span>/);
    const liveMatch = itemHtml.match(/class="live"/);
    
    if (idMatch) {
      channels.push({
        id: idMatch[1],
        name: nameMatch ? nameMatch[1].trim() : `频道${idMatch[1]}`,
        logo: '',
        currentProgram: programMatch ? programMatch[1].trim() : '未播放',
        isLive: !!liveMatch
      });
    }
  }
  
  return channels;
};

export const fetchChannelList = async (tid: 'ws' | 'ys'): Promise<Channel[]> => {
  try {
    const url = new URL(`${BASE_URL}/?tid=${tid}`);
    
    const response = await fetch(url.toString());
    const html = await response.text();
    
    const parsedChannels = parseChannelList(html);
    
    return parsedChannels.map((pc) => ({
      id: pc.id,
      name: pc.name,
      logo: '',
      category: tid === 'ws' ? '卫视' : '影视',
      currentProgram: pc.currentProgram,
      isLive: pc.isLive,
      tid: tid
    }));
  } catch (error) {
    console.error(`获取${tid === 'ws' ? '卫视频道' : '央视频道'}频道列表失败:`, error);
    
    // 返回空数组，由调用方使用备用数据
    return [];
  }
};