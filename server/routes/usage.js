// FlowAI 流智 — 用量统计路由
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getDB } = require('../db');

const router = express.Router();
router.use(authMiddleware);

router.get('/stats', (req, res) => {
  const user = getDB().get('SELECT balance, total_used FROM users WHERE id = ?', [req.userId]);

  // 今日用量
  const todayStats = getDB().get(`
    SELECT COUNT(*) as total_calls, COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(input_tokens), 0) as total_input_tokens, COALESCE(SUM(output_tokens), 0) as total_output_tokens
    FROM usage_logs WHERE user_id = ? AND date(created_at) = date('now')
  `, [req.userId]);

  // 按类型
  const byType = getDB().all(`
    SELECT task_type, COUNT(*) as count, COALESCE(SUM(cost), 0) as total_cost
    FROM usage_logs WHERE user_id = ? GROUP BY task_type ORDER BY total_cost DESC
  `, [req.userId]);

  res.json({ balance: user.balance, totalUsed: user.total_used, today: todayStats, byType });
});

router.get('/logs', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const logs = getDB().all(
    'SELECT * FROM usage_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [req.userId, Number(limit), Number(offset)]
  );

  const total = getDB().get('SELECT COUNT(*) as count FROM usage_logs WHERE user_id = ?', [req.userId]);

  res.json({
    logs,
    pagination: { page: Number(page), limit: Number(limit), total: total.count, totalPages: Math.ceil(total.count / limit) }
  });
});

module.exports = router;
