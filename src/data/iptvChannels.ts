export interface IptvChannel {
  id: string;
  name: string;
  category: string;
  currentProgram: string;
  tid: string;
  /** 播放方式: 'cctv' = 央视官网直播页(可iframe嵌套), 'ysp' = 央视频播放页(需整页导航) */
  source: 'cctv' | 'ysp';
  /** 播放 URL(官网直播页或央视频pid页) —— 播放即整页导航到该地址 */
  url: string;
  /** 备用播放 URL(如央视官网失效时可切换央视频) */
  backupUrl?: string;
}

export const cctvChannels: IptvChannel[] = [
  // ── 央视: 官网直播页 (tv.cctv.com/live/xxx), 备用 = 央视频 pid ─────────
  { id: 'c1', name: 'CCTV1 综合', category: '央视频道', currentProgram: '24小时综合直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv1/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001859' },
  { id: 'c2', name: 'CCTV2 财经', category: '央视频道', currentProgram: '24小时财经直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv2/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001800' },
  { id: 'c3', name: 'CCTV3 综艺', category: '央视频道', currentProgram: '24小时综艺直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv3/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001801' },
  { id: 'c4', name: 'CCTV4 中文国际', category: '央视频道', currentProgram: '24小时国际直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv4/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001814' },
  { id: 'c5', name: 'CCTV5 体育', category: '央视频道', currentProgram: '24小时体育直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv5/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001818' },
  { id: 'c5p', name: 'CCTV5+ 体育赛事', category: '央视频道', currentProgram: '24小时赛事直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv5plus/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001817' },
  { id: 'c6', name: 'CCTV6 电影', category: '央视频道', currentProgram: '24小时电影直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv6/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600108442' },
  { id: 'c7', name: 'CCTV7 国防军事', category: '央视频道', currentProgram: '24小时军事直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv7/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600004092' },
  { id: 'c8', name: 'CCTV8 电视剧', category: '央视频道', currentProgram: '24小时剧场直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv8/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001803' },
  { id: 'c9', name: 'CCTV9 纪录', category: '央视频道', currentProgram: '24小时纪录直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctvjilu/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600004078' },
  { id: 'c10', name: 'CCTV10 科教', category: '央视频道', currentProgram: '24小时科教直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv10/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001805' },
  { id: 'c11', name: 'CCTV11 戏曲', category: '央视频道', currentProgram: '24小时戏曲直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv11/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001806' },
  { id: 'c12', name: 'CCTV12 社会与法', category: '央视频道', currentProgram: '24小时法治直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv12/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001807' },
  { id: 'c13', name: 'CCTV13 新闻', category: '央视频道', currentProgram: '24小时新闻直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv13/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001811' },
  { id: 'c14', name: 'CCTV14 少儿', category: '央视频道', currentProgram: '24小时少儿直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctvchild/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001809' },
  { id: 'c15', name: 'CCTV15 音乐', category: '央视频道', currentProgram: '24小时音乐直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv15/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001815' },
  { id: 'c16', name: 'CCTV16 奥林匹克', category: '央视频道', currentProgram: '24小时奥运直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv16/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600098637' },
  { id: 'c17', name: 'CCTV17 农业农村', category: '央视频道', currentProgram: '24小时农业直播', tid: 'tv', source: 'cctv', url: 'https://tv.cctv.com/live/cctv17/', backupUrl: 'https://www.yangshipin.cn/tv/home?pid=600001810' },
];

export const wsChannels: IptvChannel[] = [
  // ── 卫视: 央视频播放页 (yangshipin.cn/tv/home?pid=) ────────────────────
  { id: 'w1', name: '湖南卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002475' },
  { id: 'w2', name: '江苏卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002521' },
  { id: 'w3', name: '东方卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002483' },
  { id: 'w4', name: '浙江卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002520' },
  { id: 'w5', name: '北京卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002309' },
  { id: 'w6', name: '深圳卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002481' },
  { id: 'w7', name: '广东卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002485' },
  { id: 'w8', name: '安徽卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002532' },
  { id: 'w9', name: '东南卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002484' },
  { id: 'w10', name: '河北卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002493' },
  { id: 'w11', name: '黑龙江卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002498' },
  { id: 'w12', name: '湖北卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002508' },
  { id: 'w13', name: '江西卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002503' },
  { id: 'w14', name: '辽宁卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002505' },
  { id: 'w15', name: '海南卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002506' },
  { id: 'w16', name: '山东卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002513' },
  { id: 'w17', name: '四川卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002516' },
  { id: 'w18', name: '天津卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600152137' },
  { id: 'w19', name: '重庆卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002531' },
  { id: 'w20', name: '贵州卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002490' },
  { id: 'w21', name: '吉林卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190405' },
  { id: 'w22', name: '广西卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002509' },
  { id: 'w23', name: '河南卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600002525' },
  { id: 'w24', name: '甘肃卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190408' },
  { id: 'w25', name: '青海卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190406' },
  { id: 'w26', name: '云南卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190402' },
  { id: 'w27', name: '内蒙古卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190401' },
  { id: 'w28', name: '山西卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190407' },
  { id: 'w29', name: '陕西卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190400' },
  { id: 'w30', name: '新疆卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600152138' },
  { id: 'w31', name: '西藏卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190403' },
  { id: 'w32', name: '宁夏卫视', category: '卫视频道', currentProgram: '24小时卫视直播', tid: 'ws', source: 'ysp', url: 'https://www.yangshipin.cn/tv/home?pid=600190737' },
];

export const iptvChannels: IptvChannel[] = [...cctvChannels, ...wsChannels];

export const categories = ['全部', '央视频道', '卫视频道'];
