// FlowAI 流智 — 拼多多开放平台 API 路由（正规合规方案）
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../db');
const pddOpen = require('../services/pdd-open-api');

const router = express.Router();
router.use(authMiddleware);

// 保存开放平台凭证
router.post('/credentials/:storeId', (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const { clientId, clientSecret, accessToken, refreshToken } = req.body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ error: '请提供 clientId 和 clientSecret' });
  }

  pddOpen.savePDDCredentials(storeId, req.userId, {
    clientId,
    clientSecret,
    accessToken: accessToken || '',
    refreshToken: refreshToken || ''
  });

  res.json({ message: '凭证已保存', storeId: Number(storeId) });
});

// 获取凭证状态
router.get('/credentials/:storeId', (req, res) => {
  const storeId = req.params.storeId;
  const store = getDB().get('SELECT * FROM stores WHERE id = ? AND user_id = ?', [storeId, req.userId]);
  if (!store) return res.status(404).json({ error: '店铺不存在' });

  const cred = pddOpen.getPDDCredentials(storeId);

  res.json({
    storeId: Number(storeId),
    storeName: store.name,
    configured: !!cred,
    hasAccessToken: !!(cred && cred.accessToken),
    clientId: cred ? cred.clientId.substring(0, 8) + '****' : null,
    updatedAt: cred ? cred.updatedAt : null
  });
});

// 生成 OAuth 授权链接
router.post('/auth-url/:storeId', (req, res) => {
  const storeId = req.params.storeId;
  const { clientId, redirectUri } = req.body;
  if (!clientId) return res.status(400).json({ error: '请提供 clientId' });

  const state = 'flowai_' + storeId + '_' + Date.now();
  const url = pddOpen.generateAuthUrl(clientId, redirectUri || 'http://localhost:3007/api/pdd-open/callback', state);

  res.json({ authUrl: url, state });
});

// OAuth 回调处理
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.status(400).send('授权失败：未收到授权码');

  res.send(`
    <html><head><meta charset="utf-8"><title>授权成功</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f0fdfa;flex-direction:column}
    .card{background:#fff;padding:40px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);text-align:center}
    h1{color:#0d9488} p{color:#6b7280;margin:8px 0}</style></head>
    <body><div class="card"><h1>授权成功!</h1><p>授权码已获取</p><p style="font-family:monospace;font-size:12px;background:#f3f4f6;padding:8px;border-radius:8px">${code}</p><p>请复制此授权码回到 FlowAI 完成配置</p></div></body></html>
  `);
});

// 用授权码换取 access_token
router.post('/exchange-token/:storeId', async (req, res) => {
  const storeId = req.params.storeId;
  const { code, clientId, clientSecret, redirectUri } = req.body;
  if (!code || !clientId || !clientSecret) {
    return res.status(400).json({ error: '请提供 code、clientId 和 clientSecret' });
  }

  const result = await pddOpen.getAccessToken(code, clientId, clientSecret,
    redirectUri || 'http://localhost:3007/api/pdd-open/callback');

  if (result.error_response) {
    return res.status(400).json({ error: result.error_response.error_msg || '换取 token 失败' });
  }

  // 自动保存凭证
  pddOpen.savePDDCredentials(storeId, req.userId, {
    clientId, clientSecret,
    accessToken: result.access_token,
    refreshToken: result.refresh_token || '',
    expiresAt: result.expires_in ? new Date(Date.now() + result.expires_in * 1000).toISOString() : null,
    scope: JSON.stringify(result.scope || [])
  });

  res.json({ message: 'Token 获取成功，已自动保存', storeId: Number(storeId) });
});

// 测试 API 调用 — 获取店铺信息
router.get('/test/:storeId', async (req, res) => {
  const storeId = req.params.storeId;
  const result = await pddOpen.getShopInfo(storeId);
  res.json(result);
});

// 帮助文档
router.get('/help', (req, res) => {
  res.json({
    title: '拼多多开放平台接入指南',
    prerequisite: {
      title: '你需要准备',
      items: [
        '1. 企业营业执照（拼多多开放平台要求企业认证）',
        '2. 注册开发者账号：https://open.pinduoduo.com/',
        '3. 创建应用 → 获取 client_id 和 client_secret',
        '4. 店铺主账号授权 → 获取 access_token'
      ]
    },
    steps: [
      { step: 1, title: '获取凭证', desc: '在 FlowAI 店铺管理中填入 client_id 和 client_secret' },
      { step: 2, title: '店铺授权', desc: '生成授权链接 → 拼多多商家打开授权 → 获取授权码' },
      { step: 3, title: '换取 Token', desc: '用授权码换取 access_token → 自动保存' },
      { step: 4, title: '开始使用', desc: 'FlowAI 调用开放平台 API → AI 自动处理客服消息' }
    ],
    note: '开放平台 API 完全合法合规，数据安全有保障。'
  });
});

module.exports = router;
