// FlowAI 流智 — 用户认证路由
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// 发送验证码
router.post('/send-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  getDB().run('INSERT INTO verify_codes (phone, code, expires_at) VALUES (?, ?, ?)',
    [phone, code, expiresAt]);

  console.log(`[验证码] ${phone} -> ${code}`);
  res.json({ message: '验证码已发送', code });
});

// 注册
router.post('/register', (req, res) => {
  const { phone, code, password } = req.body;
  if (!phone || !code || !password) {
    return res.status(400).json({ error: '手机号、验证码和密码不能为空' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' });
  }

  const record = getDB().get(
    'SELECT * FROM verify_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1',
    [phone, code, new Date().toISOString()]
  );
  if (!record) return res.status(400).json({ error: '验证码错误或已过期' });

  const existing = getDB().get('SELECT id FROM users WHERE phone = ?', [phone]);
  if (existing) return res.status(400).json({ error: '该手机号已注册' });

  getDB().run('UPDATE verify_codes SET used = 1 WHERE id = ?', [record.id]);

  const passwordHash = bcrypt.hashSync(password, 10);
  getDB().run('INSERT INTO users (phone, password_hash, balance) VALUES (?, ?, ?)',
    [phone, passwordHash, 1.0]);

  res.json({ message: '注册成功，已赠送1元体验金' });
});

// 登录
router.post('/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) {
    return res.status(400).json({ error: '手机号和密码不能为空' });
  }

  const user = getDB().get('SELECT * FROM users WHERE phone = ?', [phone]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: '手机号或密码错误' });
  }

  const token = jwt.sign(
    { userId: user.id, phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id, phone: user.phone, nickname: user.nickname,
      balance: user.balance, totalUsed: user.total_used
    }
  });
});

// 获取当前用户
router.get('/me', authMiddleware, (req, res) => {
  const user = getDB().get(
    'SELECT id, phone, nickname, balance, total_used, created_at FROM users WHERE id = ?',
    [req.userId]
  );
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

module.exports = router;
