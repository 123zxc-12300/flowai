// FlowAI 流智 — 文案生成路由
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { generateContent } = require('../services/ai');

const router = express.Router();
router.use(authMiddleware);

const COPY_TYPES = [
  { key: 'product_desc', name: '商品描述', icon: '📦' },
  { key: 'social_post', name: '社交媒体文案', icon: '📱' },
  { key: 'ad_copy', name: '广告文案', icon: '🎯' },
  { key: 'email_campaign', name: '邮件营销', icon: '📧' },
  { key: 'brand_slogan', name: '品牌Slogan', icon: '✨' },
  { key: 'seo_article', name: 'SEO文章', icon: '📝' },
  { key: 'video_script', name: '视频脚本', icon: '🎬' },
  { key: 'custom', name: '自定义需求', icon: '💡' }
];

router.get('/types', (req, res) => {
  res.json({ types: COPY_TYPES });
});

function getPromptTemplate(type, params) {
  const { product, target, tone, length, extra } = params;
  const templates = {
    product_desc: `为以下产品写一段吸引人的商品描述：\n产品：${product}\n目标受众：${target || '普通消费者'}\n风格：${tone || '专业有吸引力'}\n${length ? `字数要求：约${length}字\n` : ''}${extra ? `补充要求：${extra}\n` : ''}\n请直接输出文案内容。`,
    social_post: `为以下主题写一条社交媒体推广文案：\n主题/产品：${product}\n平台：${target || '微信公众号'}\n风格：${tone || '轻松有趣'}\n${length ? `字数要求：约${length}字\n` : ''}${extra ? `补充要求：${extra}\n` : ''}\n请直接输出文案，可适当包含emoji和话题标签。`,
    ad_copy: `为以下产品写广告文案：\n产品：${product}\n目标受众：${target || '大众'}\n广告风格：${tone || '简洁有力'}\n${length ? `字数要求：约${length}字\n` : ''}${extra ? `补充要求：${extra}\n` : ''}\n请直接输出广告文案。`,
    email_campaign: `写一封营销邮件：\n推广内容：${product}\n收件人：${target || '潜在客户'}\n邮件风格：${tone || '专业亲切'}\n${length ? `字数要求：约${length}字\n` : ''}${extra ? `补充要求：${extra}\n` : ''}\n请输出完整的邮件内容，包含标题和正文。`,
    brand_slogan: `为以下品牌创作Slogan：\n品牌/产品：${product}\n品牌定位：${target || '高端品质'}\n风格偏好：${tone || '朗朗上口易传播'}\n${extra ? `补充要求：${extra}\n` : ''}\n请提供5个Slogan备选，每个附带简短说明。`,
    seo_article: `写一篇SEO优化文章：\n主题：${product}\n目标读者：${target || '普通网友'}\n文章风格：${tone || '专业易懂'}\n${length ? `字数要求：约${length}字\n` : ''}${extra ? `补充要求：${extra}\n` : ''}\n请输出完整的文章内容，包含标题。`,
    video_script: `写一段短视频脚本：\n视频主题：${product}\n平台：${target || '抖音'}\n风格：${tone || '节奏紧凑'}\n${length ? `时长/字数：约${length}字\n` : ''}${extra ? `补充要求：${extra}\n` : ''}\n请输出完整的脚本，包含画面描述和台词。`,
    custom: `${product || '请帮我写一段文案'}\n${target ? `目标：${target}\n` : ''}${tone ? `风格：${tone}\n` : ''}${length ? `字数：约${length}字\n` : ''}${extra ? `其他：${extra}\n` : ''}\n请直接输出。`
  };
  return templates[type] || templates.custom;
}

router.post('/generate', async (req, res) => {
  const { type, product, target, tone, length, extra } = req.body;
  if (!type || !product) {
    return res.status(400).json({ error: '请选择文案类型并填写文案主题' });
  }
  const taskType = COPY_TYPES.find(t => t.key === type);
  if (!taskType) return res.status(400).json({ error: '不支持的文案类型' });

  try {
    const prompt = getPromptTemplate(type, { product, target, tone, length, extra });
    const result = await generateContent(req.userId, 'copywriting', [
      { role: 'system', content: '你是一个专业的文案撰写专家，擅长各类商业文案创作。请根据用户需求生成高质量文案。' },
      { role: 'user', content: prompt }
    ]);

    res.json({
      type: taskType.key,
      typeName: taskType.name,
      result: result.content,
      usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, cost: result.cost }
    });
  } catch (err) {
    console.error('[文案生成] 错误:', err.message);
    res.status(err.message.includes('余额不足') ? 402 : 500).json({ error: err.message });
  }
});

module.exports = router;
