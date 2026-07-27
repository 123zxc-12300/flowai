// FlowAI 流智 — 支付路由
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../db');

const router = express.Router();
router.use(authMiddleware);

const PLANS = [
  { id: 'plan_10', name: '10元体验包', amount: 10, credits: 10, tag: '入门' },
  { id: 'plan_50', name: '50元标准包', amount: 50, credits: 55, tag: '推荐' },
  { id: 'plan_100', name: '100元专业包', amount: 100, credits: 115, tag: '超值' },
  { id: 'plan_500', name: '500元企业包', amount: 500, credits: 625, tag: '企业' }
];

router.get('/plans', (req, res) => {
  res.json({ plans: PLANS });
});

router.post('/create-order', (req, res) => {
  const { planId } = req.body;
  const plan = PLANS.find(p => p.id === planId);
  if (!plan) return res.status(400).json({ error: '无效的套餐' });

  const orderNo = `FLOW${Date.now()}${Math.floor(Math.random() * 1000)}`;
  getDB().run(
    'INSERT INTO orders (order_no, user_id, amount, credits, status) VALUES (?, ?, ?, ?, ?)',
    [orderNo, req.userId, plan.amount, plan.credits, 'pending']
  );

  const order = getDB().get('SELECT * FROM orders WHERE order_no = ?', [orderNo]);
  res.json({ orderId: order.id, orderNo, amount: plan.amount, credits: plan.credits, message: `订单创建成功，需支付 ¥${plan.amount}` });
});

router.post('/mock-pay', (req, res) => {
  const { orderId } = req.body;
  const order = getDB().get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.userId]);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  if (order.status === 'paid') return res.status(400).json({ error: '订单已支付' });

  getDB().run("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?", [new Date().toISOString(), orderId]);
  getDB().run('UPDATE users SET balance = balance + ? WHERE id = ?', [order.credits, req.userId]);

  const user = getDB().get('SELECT balance FROM users WHERE id = ?', [req.userId]);
  res.json({ message: '支付成功！', credited: order.credits, balance: user.balance });
});

router.get('/history', (req, res) => {
  const orders = getDB().all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [req.userId]);
  res.json({ orders });
});

module.exports = router;
