// FlowAI 流智 — 电商客服路由
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { generateContent } = require('../services/ai');

const router = express.Router();
router.use(authMiddleware);

// 客服配置模板
const TONE_OPTIONS = [
  { key: 'warm', name: '热情亲切' },
  { key: 'pro', name: '专业简洁' },
  { key: 'cute', name: '幽默可爱' }
];

// 快捷场景
const QUICK_SCENARIOS = [
  { label: '💰 问价格', message: '这个多少钱？' },
  { label: '🚚 问发货', message: '什么时候发货？什么快递？' },
  { label: '🔄 问退换', message: '不合适可以退吗？怎么退？' },
  { label: '📏 问尺寸', message: '有什么尺寸/颜色可以选？' },
  { label: '🎁 问优惠', message: '有优惠吗？能便宜点吗？' },
  { label: '💬 砍价', message: '太贵了，能便宜点吗？别人家都比你便宜' }
];

// 构建客服系统提示词
function buildSystemPrompt(config) {
  const toneGuide = {
    warm: '热情亲切：使用"亲"等亲切称呼，多使用~和表情，营造温暖的购物氛围',
    pro: '专业简洁：语言精炼专业，重点突出产品和服务的优势，不啰嗦',
    cute: '幽默可爱：使用活泼的语气、emoji和网络流行语，让对话轻松有趣'
  };

  return `你是一个专业的电商客服AI，正在为店铺【${config.shopName || '未命名店铺'}】工作。

## 店铺信息
- 主营产品：${config.products || '未设置'}
- 退款政策：${config.refundPolicy || '未设置'}
- 发货信息：${config.shippingInfo || '未设置'}
- 回复风格：${toneGuide[config.tone] || toneGuide.pro}

## 核心规则
1. 只回答与店铺产品、订单、售后相关的问题
2. 如果买家问的问题超出你的知识范围，礼貌引导联系人工客服
3. 不要编造不存在的信息（如不确定就说"我帮您确认一下"）
4. 保持简洁，每次回复控制在2-4句话
5. 主动引导下单：在合适的时候提示可以下单、发优惠等
6. 遇到售后问题优先安抚情绪，再给解决方案
7. 绝对不能说自己是AI，始终保持"我是客服"的人设

## 回复格式
直接输出回复内容，不要加"客服："等前缀。`;
}

// 获取快捷场景列表
router.get('/scenarios', (req, res) => {
  res.json({ scenarios: QUICK_SCENARIOS });
});

// 获取风格选项
router.get('/tones', (req, res) => {
  res.json({ tones: TONE_OPTIONS });
});

// 客服对话
router.post('/chat', async (req, res) => {
  const { message, config, history } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  const shopConfig = config || {};
  const chatHistory = history || [];

  try {
    // 构建消息列表
    const messages = [
      { role: 'system', content: buildSystemPrompt(shopConfig) }
    ];

    // 添加历史对话（最近10轮）
    const recentHistory = chatHistory.slice(-20);
    for (const h of recentHistory) {
      messages.push({ role: 'user', content: h.user });
      messages.push({ role: 'assistant', content: h.assistant });
    }

    // 添加当前消息
    messages.push({ role: 'user', content: message });

    const result = await generateContent(req.userId, 'customer_service', messages, {
      temperature: 0.7,
      maxTokens: 500
    });

    res.json({
      reply: result.content,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost
      }
    });
  } catch (err) {
    console.error('[客服对话] 错误:', err.message);
    res.status(err.message.includes('余额不足') ? 402 : 500).json({ error: err.message });
  }
});

module.exports = router;
