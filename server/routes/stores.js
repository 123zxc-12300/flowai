// FlowAI 流智 — 多店铺管理路由
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../db');

const router = express.Router();
router.use(authMiddleware);

// 支持的平台
const PLATFORMS = [
  { key: 'pinduoduo', name: '拼多多', icon: '📦' },
  { key: 'taobao', name: '淘宝/千牛', icon: '🛒' },
  { key: 'douyin', name: '抖音/抖店', icon: '🎵' },
  { key: 'kuaishou', name: '快手小店', icon: '⚡' },
  { key: 'jd', name: '京东', icon: '🏪' },
  { key: 'other', name: '其他平台', icon: '🔗' }
];

// 店铺列表
router.get('/', (req, res) => {
  const stores = getDB().all(
    'SELECT * FROM stores WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  res.json({ stores, platforms: PLATFORMS });
});

// 创建店铺
router.post('/', (req, res) => {
  const { name, platform, shop_name, products, reply_tone, refund_policy, shipping_info, knowledge_base } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '店铺名称不能为空' });
  }

  const platformInfo = PLATFORMS.find(p => p.key === (platform || 'pinduoduo'));
  if (!platformInfo) {
    return res.status(400).json({ error: '不支持的平台' });
  }

  getDB().run(
    `INSERT INTO stores (user_id, name, platform, shop_name, products, reply_tone, refund_policy, shipping_info, knowledge_base)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, name.trim(), platform || 'pinduoduo', shop_name || '', products || '',
     reply_tone || '热情亲切', refund_policy || '', shipping_info || '', knowledge_base || '']
  );

  const store = getDB().get('SELECT * FROM stores WHERE user_id = ? ORDER BY id DESC LIMIT 1', [req.userId]);
  res.json({ store });
});

// 更新店铺
router.put('/:id', (req, res) => {
  const storeId = req.params.id;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const { name, shop_name, products, reply_tone, refund_policy, shipping_info, knowledge_base } = req.body;

  getDB().run(
    `UPDATE stores SET name=?, shop_name=?, products=?, reply_tone=?, refund_policy=?, shipping_info=?, knowledge_base=?, updated_at=CURRENT_TIMESTAMP
     WHERE id=? AND user_id=?`,
    [
      name || store.name, shop_name || store.shop_name, products || store.products,
      reply_tone || store.reply_tone, refund_policy || store.refund_policy,
      shipping_info || store.shipping_info, knowledge_base || store.knowledge_base,
      storeId, req.userId
    ]
  );

  const updated = getDB().get('SELECT * FROM stores WHERE id = ?', [storeId]);
  res.json({ store: updated });
});

// 删除店铺
router.delete('/:id', (req, res) => {
  const storeId = req.params.id;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  getDB().run('DELETE FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  res.json({ message: '已删除' });
});

// 获取单个店铺详情
router.get('/:id', (req, res) => {
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });
  res.json({ store, platforms: PLATFORMS });
});

module.exports = router;
