#ifndef LPTV_CHANNELS_H
#define LPTV_CHANNELS_H

#include <cstdint>
#include <cstring>

struct Source {
  int  priority;
  const char* domain;
  const char* url;
};

struct Channel {
  int     id;
  const char* name;
  const char* category;
  Source    sources[4];
};

constexpr Channel kChannels[] = {
  // CCTV 1-17 (id 1-17)
  { 1, "CCTV1 综合",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv1/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001859"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 2, "CCTV2 财经",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv2/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001800"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 3, "CCTV3 综艺",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv3/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001801"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 4, "CCTV4 中文国际","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv4/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001814"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 5, "CCTV5 体育",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv5/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001818"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 6, "CCTV6 电影",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv6/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600108442"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 7, "CCTV7 国防军事","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv7/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600004092"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 8, "CCTV8 电视剧", "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv8/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001803"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  { 9, "CCTV9 纪录",   "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctvjilu/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600004078"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {10, "CCTV10 科教",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv10/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001805"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {11, "CCTV11 戏曲",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv11/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001806"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {12, "CCTV12 社会与法","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv12/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001807"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {13, "CCTV13 新闻",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv13/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001811"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {14, "CCTV14 少儿",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctvchild/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001809"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {15, "CCTV15 音乐",  "央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv15/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001815"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {16, "CCTV16 奥林匹克","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv16/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600098637"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {17, "CCTV17 农业农村","央视频道", {
    {1, "cctv",  "https://tv.cctv.com/live/cctv17/"},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600001810"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  // 卫视 1-32 (id 18-49)
  {18, "湖南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002475"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {19, "江苏卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002521"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {20, "东方卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002483"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {21, "浙江卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002520"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {22, "北京卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002309"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {23, "深圳卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002481"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {24, "广东卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002485"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {25, "安徽卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002532"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {26, "东南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002484"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {27, "河北卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002493"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {28, "黑龙江卫视","卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002498"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {29, "湖北卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002508"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {30, "江西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002503"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {31, "辽宁卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002505"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {32, "海南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002506"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {33, "山东卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002513"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {34, "四川卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002516"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {35, "天津卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600152137"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {36, "重庆卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002531"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {37, "贵州卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002490"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {38, "吉林卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190405"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {39, "广西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002509"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {40, "河南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600002525"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {41, "甘肃卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190408"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {42, "青海卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190406"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {43, "云南卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190402"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {44, "内蒙古卫视","卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190401"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {45, "山西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190407"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {46, "陕西卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190400"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {47, "新疆卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600152138"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {48, "西藏卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190403"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
  {49, "宁夏卫视", "卫视频道", {
    {1, "cctv",  ""},
    {2, "ysp",   "https://www.yangshipin.cn/tv/home?pid=600190737"},
    {3, "789",  ""},
    {4, "345",  ""},
  }},
};

constexpr int kChannelCount = sizeof(kChannels) / sizeof(kChannels[0]);

static inline const Channel* get_channel(int id) {
  if (id < 1 || id > kChannelCount) return nullptr;
  return &kChannels[id - 1];
}

#endif // LPTV_CHANNELS_H
