// FlowAI 流智 — 自动化 SaaS 平台服务端
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./db');

async function main() {
  // 初始化数据库
  await initDB();

  const app = express();
  const PORT = process.env.PORT || 3007;

  // 中间件
  app.use(cors());
  app.use(express.json());

  // 静态文件（前端页面）
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // API 路由
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/copywriting', require('./routes/copywriting'));
  app.use('/api/payment', require('./routes/payment'));
  app.use('/api/usage', require('./routes/usage'));
app.use('/api/customer-service', require('./routes/customer-service'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/pdd', require('./routes/pdd'));
app.use('/api/pdd-open', require('./routes/pdd-open'));

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'FlowAI 流智', version: '1.0.0' });
  });

  // 前端 SPA fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: '接口不存在' });
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  app.listen(PORT, () => {
    console.log(`\n🚀 FlowAI 流智 服务已启动`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📍 http://localhost:${PORT}/api/health\n`);
  });
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});
