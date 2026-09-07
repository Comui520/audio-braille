export const READER_BANK_VERSION = 'reader-v13-1'

const PASSAGE_SEEDS = [
  ['日常出行', '一位学生在早晨整理书包，准备乘车去学校。', 'yi1 wei4 xue2 sheng1 zai4 zao3 chen2 zheng3 li3 shu1 bao1 zhun3 bei4 cheng2 che1 qu4 xue2 xiao4', 'daily', 'low'],
  ['整理房间', '小雨把桌上的书本放回书架，也擦干净了窗台。', 'xiao3 yu3 ba3 zhuo1 shang4 de5 shu1 ben3 fang4 hui2 shu1 jia4 ye3 ca1 gan1 jing4 le5 chuang1 tai2', 'daily', 'low'],
  ['菜市场', '早晨的菜市场很热闹，摊主正在摆放新鲜蔬菜。', 'zao3 chen2 de5 cai4 shi4 chang3 hen3 re4 nao4 tan1 zhu3 zheng4 zai4 bai3 fang4 xin1 xian1 shu1 cai4', 'daily', 'medium'],
  ['雨天回家', '放学时下起小雨，朋友提醒大家带好雨具。', 'fang4 xue2 shi2 xia4 qi3 xiao3 yu3 peng2 you3 ti2 xing3 da4 jia1 dai4 hao3 yu3 ju4', 'daily', 'low'],
  ['公园散步', '傍晚，人们在公园慢慢散步，孩子们在草地上奔跑。', 'bang4 wan3 ren2 men5 zai4 gong1 yuan2 man4 man4 san4 bu4 hai2 zi5 men5 zai4 cao3 di4 shang4 ben1 pao3', 'daily', 'medium'],
  ['邻里互助', '邻居发现楼道的灯坏了，于是一起联系管理员。', 'lin2 ju1 fa1 xian4 lou2 dao4 de5 deng1 huai4 le5 yu2 shi4 yi4 qi3 lian2 xi4 guan3 li3 yuan2', 'daily', 'medium'],
  ['早餐时间', '奶奶煮好热粥，又把水果切成小块放在盘子里。', 'nai3 nai5 zhu3 hao3 re4 zhou1 you4 ba3 shui3 guo3 qie1 cheng2 xiao3 kuai4 fang4 zai4 pan2 zi5 li3', 'daily', 'low'],
  ['车站等车', '车站广播提醒乘客，开往北方的列车即将进站。', 'che1 zhan4 guang3 bo1 ti2 xing3 cheng2 ke4 kai1 wang3 bei3 fang1 de5 lie4 che1 ji2 jiang1 jin4 zhan4', 'daily', 'medium'],
  ['四季变化', '春天花开，夏天树叶茂盛，秋天果实成熟，冬天空气清凉。', 'chun1 tian1 hua1 kai1 xia4 tian1 shu4 ye4 mao4 sheng4 qiu1 tian1 guo3 shi2 cheng2 shu2 dong1 tian1 kong1 qi4 qing1 liang2', 'nature', 'medium'],
  ['小河边', '小河在山脚下缓缓流过，水面映着天空和远处的树。', 'xiao3 he2 zai4 shan1 jiao3 xia4 huan3 huan3 liu2 guo4 shui3 mian4 ying4 zhe5 tian1 kong1 he2 yuan3 chu4 de5 shu4', 'nature', 'medium'],
  ['林中声音', '清晨的树林里有鸟鸣，也有风吹树叶的沙沙声。', 'qing1 chen2 de5 shu4 lin2 li3 you3 niao3 ming2 ye3 you3 feng1 chui1 shu4 ye4 de5 sha1 sha1 sheng1', 'nature', 'medium'],
  ['观察云朵', '孩子躺在草地上观察云朵，想象它们像船和山。', 'hai2 zi5 tang3 zai4 cao3 di4 shang4 guan1 cha2 yun2 duo3 xiang3 xiang4 ta1 men5 xiang4 chuan2 he2 shan1', 'nature', 'low'],
  ['保护河流', '大家捡起河边的塑料瓶，希望让水面保持清洁。', 'da4 jia1 jian3 qi3 he2 bian1 de5 su4 liao4 ping2 xi1 wang4 rang4 shui3 mian4 bao3 chi2 qing1 jie2', 'nature', 'medium'],
  ['种下树苗', '春雨过后，志愿者在校园角落种下许多树苗。', 'chun1 yu3 guo4 hou4 zhi4 yuan4 zhe3 zai4 xue2 yuan2 jiao3 luo4 zhong4 xia4 xu3 duo1 shu4 miao2', 'nature', 'medium'],
  ['夜空星星', '夜空很安静，几颗明亮的星星从云层后面出现。', 'ye4 kong1 hen3 an1 jing4 ji3 ke1 ming2 liang4 de5 xing1 xing5 cong2 yun2 ceng2 hou4 mian4 chu1 xian4', 'nature', 'low'],
  ['植物生长', '阳光、水和土壤共同帮助种子慢慢发芽生长。', 'yang2 guang1 shui3 he2 tu3 rang3 gong4 tong2 bang1 zhu4 zhong3 zi5 man4 man4 fa1 ya2 sheng1 zhang3', 'nature', 'medium'],
  ['图书馆借书', '老师带同学参观图书馆，并介绍怎样查找需要的资料。', 'lao3 shi1 dai4 tong2 xue2 can1 guan1 tu2 shu1 guan3 bing4 jie4 shao4 zen3 yang4 cha2 zhao3 xu1 yao4 de5 zi1 liao4', 'learning', 'medium'],
  ['记录实验', '研究小组先写下问题，再安排步骤并记录每次结果。', 'yan2 jiu1 xiao3 zu3 xian1 xie3 xia4 wen4 ti2 zai4 an1 pai2 bu4 zhou4 bing4 ji4 lu4 mei3 ci4 jie2 guo3', 'learning', 'high'],
  ['练习发音', '小组成员轮流朗读，互相指出停顿和重音的位置。', 'xiao3 zu3 cheng2 yuan2 lun2 liu2 lang3 du2 hu4 xiang1 zhi3 chu1 ting2 dun4 he2 zhong4 yin1 de5 wei4 zhi4', 'learning', 'medium'],
  ['学习地图', '学生根据地图寻找路线，最后在广场集合。', 'xue2 sheng1 gen1 ju4 di4 tu2 xun2 zhao3 lu4 xian4 zui4 hou4 zai4 guang3 chang3 ji2 he2', 'learning', 'low'],
  ['问题讨论', '课堂讨论没有唯一答案，重要的是说明理由和证据。', 'ke4 tang2 tao3 lun4 mei2 you3 wei2 yi1 da2 an4 zhong4 yao4 de5 shi4 shuo1 ming2 li3 you2 he2 zheng4 ju4', 'learning', 'medium'],
  ['做读书卡', '读完一篇文章后，学生用几句话写下主要内容。', 'du2 wan2 yi1 pian1 wen2 zhang1 hou4 xue2 sheng1 yong4 ji3 ju4 hua4 xie3 xia4 zhu3 yao4 nei4 rong2', 'learning', 'low'],
  ['安静阅读', '安静阅读时，可以把注意力放在句子的意思和结构上。', 'an1 jing4 yue4 du2 shi2 ke3 yi3 ba3 zhu4 yi4 li4 fang4 zai4 ju4 zi5 de5 yi4 si5 he2 jie2 gou4 shang4', 'learning', 'medium'],
  ['新的词语', '遇到新的词语时，先根据上下文猜测，再查字典确认。', 'yu4 dao4 xin1 de5 ci2 yu3 shi2 xian1 gen1 ju4 shang4 xia4 wen2 cai1 ce4 zai4 cha2 zi4 dian3 que4 ren4', 'learning', 'medium'],
  ['团队分工', '团队开始工作前，成员先确认目标、时间和各自负责的部分。', 'tuan2 dui4 kai1 shi3 gong1 zuo4 qian2 cheng2 yuan2 xian1 que4 ren4 mu4 biao1 shi2 jian1 he2 ge4 zi4 fu4 ze2 de5 bu4 fen5', 'work', 'medium'],
  ['会议准备', '会议开始前，工作人员检查投影、座位和纸笔是否齐全。', 'hui4 yi4 kai1 shi3 qian2 gong1 zuo4 ren2 yuan2 jian3 cha2 tou2 ying3 zuo4 wei4 he2 zhi3 bi3 shi4 fou3 qi2 quan2', 'work', 'medium'],
  ['商店盘点', '店员按照清单盘点货物，把缺少的商品记在本子上。', 'dian4 yuan2 an4 zhao4 qing1 dan1 pan2 dian3 huo4 wu4 ba3 que1 shao3 de5 shang1 pin3 ji4 zai4 ben3 zi5 shang4', 'work', 'low'],
  ['计划项目', '项目负责人把大任务分成小步骤，每周检查一次进度。', 'xiang4 mu4 fu4 ze2 ren2 ba3 da4 ren4 wu4 fen1 cheng2 xiao3 bu4 zhou4 mei3 zhou1 jian3 cha2 yi1 ci4 jin4 du4', 'work', 'medium'],
  ['回复消息', '工作结束后，他整理当天的消息，并回复需要处理的事项。', 'gong1 zuo4 jie2 shu4 hou4 ta1 zheng3 li3 dang1 tian1 de5 xiao1 xi5 bing4 hui2 fu4 xu1 yao4 chu3 li3 de5 shi4 xiang4', 'work', 'low'],
  ['安全提醒', '进入工作区域前，请先阅读提示并确认通道没有障碍物。', 'jin4 ru4 gong1 zuo4 qu1 yu4 qian2 qing3 xian1 yue4 du2 ti2 shi4 bing4 que4 ren4 tong1 dao4 mei2 you3 zhang4 ai4 wu4', 'work', 'medium'],
  ['分享经验', '同事在午后分享工作经验，大家把有用的方法记下来。', 'tong2 shi4 zai4 wu3 hou4 fen1 xiang3 gong1 zuo4 jing1 yan4 da4 jia1 ba3 you3 yong4 de5 fang1 fa3 ji4 xia4 lai2', 'work', 'low']
]

function lengthStratum(text) {
  const length = [...text].length
  return length < 24 ? 'short' : length < 38 ? 'medium' : 'long'
}

export const READER_PASSAGES = PASSAGE_SEEDS.map(([title, text, pinyin, topicStratum, difficultyStratum], index) => ({
  passageId: `reader-${String(index + 1).padStart(3, '0')}`,
  passageVersion: READER_BANK_VERSION,
  title,
  text,
  pinyin,
  lengthStratum: lengthStratum(text),
  topicStratum,
  difficultyStratum
}))

function seededRandom(seed) {
  let value = 2166136261
  for (const char of String(seed)) {
    value ^= char.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return () => {
    value = Math.imul(value ^ (value >>> 15), 1 | value) + 0x6D2B79F5
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function sampleReaderPassages(passages = READER_PASSAGES, count = 3, seed = 'reader-default') {
  const random = seededRandom(seed)
  const groups = new Map()
  for (const passage of passages) {
    if (!groups.has(passage.lengthStratum)) groups.set(passage.lengthStratum, [])
    groups.get(passage.lengthStratum).push(passage)
  }
  const queues = [...groups.values()].map(items => [...items])
  const selected = []
  for (const queue of queues) {
    if (selected.length >= count) break
    if (queue.length > 0) selected.push(queue.splice(Math.floor(random() * queue.length), 1)[0])
  }
  while (selected.length < Math.min(count, passages.length)) {
    const available = queues.filter(items => items.length > 0)
    if (!available.length) break
    const queue = available[Math.floor(random() * available.length)]
    selected.push(queue.splice(Math.floor(random() * queue.length), 1)[0])
  }
  return selected
}
