// FlowAI 流智 — AI 服务（对接 DeepSeek API）
const { getDB } = require('../db');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';

const PRICING = {
  copywriting: { input: 0.000004, output: 0.000016 },
  resume:     { input: 0.000004, output: 0.000016 },
  image:      { input: 0.000004, output: 0.000016 },
  video:      { input: 0.000004, output: 0.000016 },
  customer_service: { input: 0.000004, output: 0.000016 },
};

async function generateContent(userId, taskType, messages, options = {}) {
  const db = getDB();
  const { temperature = 0.7, maxTokens = 2048 } = options;

  const user = db.get('SELECT balance FROM users WHERE id = ?', [userId]);
  if (!user) throw new Error('用户不存在');
  if (user.balance <= 0) throw new Error('余额不足，请先充值');

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: 'deepseek-v4-pro',
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI 调用失败: ${err}`);
  }

  const data = await response.json();
  const usage = data.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;

  const pricing = PRICING[taskType] || PRICING.copywriting;
  const cost = inputTokens * pricing.input + outputTokens * pricing.output;

  db.run('UPDATE users SET balance = balance - ?, total_used = total_used + ? WHERE id = ?',
    [cost, cost, userId]);

  db.run('INSERT INTO usage_logs (user_id, task_type, input_tokens, output_tokens, cost) VALUES (?, ?, ?, ?, ?)',
    [userId, taskType, inputTokens, outputTokens, cost]);

  return {
    content: data.choices[0]?.message?.content || '',
    inputTokens,
    outputTokens,
    cost: Math.round(cost * 10000) / 10000
  };
}

module.exports = { generateContent, PRICING };
