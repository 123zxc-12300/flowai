// FlowAI 流智 — 拼多多平台对接路由
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../db');
const pdd = require('../services/pdd-connector');

const router = express.Router();
router.use(authMiddleware);

// 获取店铺的 PDD 连接状态
router.get('/status/:storeId', (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const cookies = pdd.loadStoreCookies(storeId);
  const savedCookie = getDB().get("SELECT * FROM store_cookies WHERE store_id = ? ORDER BY updated_at DESC LIMIT 1", [storeId]);

  res.json({
    storeId: Number(storeId),
    storeName: store.name,
    hasCookies: !!cookies,
    lastLogin: savedCookie ? savedCookie.updated_at : null,
    status: cookies ? '已登录' : '未登录'
  });
});

// 生成登录 URL（需要用户在浏览器中打开以完成拼多多登录）
router.post('/login/:storeId', async (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '请提供拼多多商家账号和密码' });
  }

  // 标记登录状态为"进行中"
  getDB().run(
    'INSERT OR REPLACE INTO store_cookies (store_id, user_id, status, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
    [storeId, req.userId, 'logging_in']
  );

  res.json({
    message: '请在服务端日志中查看登录进度。开发模式下，Cookie 可以通过手动粘贴导入。',
    storeId: Number(storeId),
    status: 'logging_in',
    hint: '使用 POST /api/pdd/import-cookies/:storeId 手动导入 Cookie'
  });
});

// 手动导入 Cookie（开发模式 / 备用方案）
router.post('/import-cookies/:storeId', (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const { cookies } = req.body;
  if (!cookies || !Array.isArray(cookies)) {
    return res.status(400).json({ error: '请提供 Cookie 数组 [{name,value,domain}]' });
  }

  pdd.saveStoreCookies(storeId, cookies);

  // 保存到数据库
  getDB().run(
    'INSERT OR REPLACE INTO store_cookies (store_id, user_id, cookie_data, status, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [storeId, req.userId, JSON.stringify(cookies), 'active']
  );

  res.json({ message: 'Cookie 已导入', storeId: Number(storeId), count: cookies.length });
});

// 检查 Cookie 是否有效
router.post('/verify/:storeId', async (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const cookies = pdd.loadStoreCookies(storeId);
  if (!cookies) return res.json({ valid: false, reason: '没有保存的 Cookie' });

  const valid = await pdd.checkCookieValid(cookies);
  res.json({ valid, message: valid ? 'Cookie 有效' : 'Cookie 已失效，请重新登录' });
});

// 测试发送消息
router.post('/test-send/:storeId', async (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const cookies = pdd.loadStoreCookies(storeId);
  if (!cookies) return res.status(400).json({ error: '店铺尚未登录，请先导入 Cookie' });

  const { recipientUid, content } = req.body;
  if (!recipientUid || !content) {
    return res.status(400).json({ error: '请提供 recipientUid 和 content' });
  }

  const result = await pdd.sendTextMessage(cookies, recipientUid, content);
  res.json(result);
});

// 获取 Cookie 导入说明
router.get('/help', (req, res) => {
  res.json({
    title: '如何获取拼多多商家后台 Cookie',
    platforms: ['chrome', 'edge'],
    steps: [
      '1. 在浏览器中打开 https://mms.pinduoduo.com/ 并登录',
      '2. 按 F12 打开开发者工具',
      '3. 点击 Application（应用程序）→ Cookies',
      '4. 复制所有 Cookie',
      '5. 使用 POST /api/pdd/import-cookies/:storeId 导入'
    ],
    importFormat: {
      cookies: [
        { name: 'PDD_TOKEN', value: '...', domain: '.pinduoduo.com' },
        { name: 'JSESSIONID', value: '...', domain: 'mms.pinduoduo.com' }
      ]
    }
  });
});

module.exports = router;
