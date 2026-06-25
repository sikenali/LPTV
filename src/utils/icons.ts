const channelColors: Record<string, string> = {
  'CCTV-1': '#D41414',
  'CCTV-2': '#0066CC',
  'CCTV-3': '#FF6B00',
  'CCTV-4': '#0099FF',
  'CCTV-5': '#E53935',
  'CCTV-5+': '#E53935',
  'CCTV-6': '#00AEEF',
  'CCTV-7': '#2E7D32',
  'CCTV-8': '#7B1FA2',
  'CCTV-9': '#00897B',
  'CCTV-10': '#5D4037',
  'CCTV-11': '#8D6E63',
  'CCTV-12': '#546E7A',
  'CCTV-13': '#E53935',
  'CCTV-14': '#FF5722',
  'CCTV-15': '#1E88E5',
  'CCTV-16': '#00ACC1',
  '北京卫视': '#D41414',
  '东方卫视': '#D41414',
  '湖南卫视': '#FF6B00',
  '浙江卫视': '#1E88E5',
  '江苏卫视': '#1565C0',
  '深圳卫视': '#00838F',
  '广东卫视': '#E65100',
  '河南卫视': '#BF360C',
  '东南卫视': '#1B5E20',
  '山东卫视': '#E65100',
  '安徽卫视': '#43A047',
  '天津卫视': '#1565C0',
  '四川卫视': '#BF360C',
  '湖北卫视': '#43A047',
  '江西卫视': '#E53935',
  '辽宁卫视': '#1565C0',
  '云南卫视': '#2E7D32',
  '广西卫视': '#2E7D32',
  '陕西卫视': '#BF360C',
  '黑龙江卫视': '#1565C0',
  '吉林卫视': '#1565C0',
  '内蒙古卫视': '#2E7D32',
  '新疆卫视': '#D41414',
  '西藏卫视': '#2E7D32',
  '青海卫视': '#1E88E5',
  '甘肃卫视': '#795548',
  '宁夏卫视': '#F57C00',
  '贵州卫视': '#43A047',
  '重庆卫视': '#D41414',
  '旅游卫视': '#00897B',
  '凤凰卫视': '#1565C0',
  '凤凰资讯': '#1565C0',
  '电影频道': '#E53935',
  '电视剧频道': '#7B1FA2',
};

export const getChannelLogo = (channelName: string): string => {
  const color = channelColors[channelName] || generateRandomColor();
  const bgColor = encodeURIComponent(color);
  const text = encodeURIComponent(channelName.slice(0, 2));
  
  return `https://ui-avatars.com/api/?name=${text}&background=${bgColor}&color=ffffff&size=64&font-size=0.4`;
};

const generateRandomColor = (): string => {
  const colors = [
    '#D41414', '#0066CC', '#FF6B00', '#0099FF', '#E53935',
    '#00AEEF', '#2E7D32', '#7B1FA2', '#00897B', '#1E88E5'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

