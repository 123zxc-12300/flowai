// FlowAI 流智 — 拼多多平台对接层
// 基于开源项目 pdd-auto-reply 的思路，用 Node.js + Playwright 实现
const { getDB } = require('../db');
const fs = require('fs');
const path = require('path');

// PDD API 端点（来自 pdd-auto-reply 实测）
const PDD = {
  LOGIN_URL: 'https://mms.pinduoduo.com/login',
  HOME_URL: 'https://mms.pinduoduo.com/home/',
  SEND_MESSAGE_URL: 'https://mms.pinduoduo.com/plateau/chat/send_message',
  SEND_IMAGE_URL: 'https://mms.pinduoduo.com/plateau/chat/send_message',
  MALL_GOODS_CARD_URL: 'https://mms.pinduoduo.com/plateau/message/send/mallGoodsCard',
  MOVE_CONVERSATION_URL: 'https://mms.pinduoduo.com/plateau/chat/move_conversation',
  GET_CONVERSATIONS_URL: 'https://mms.pinduoduo.com/plateau/chat/get_conversations',
  GET_CHAT_HISTORY_URL: 'https://mms.pinduoduo.com/plateau/chat/get_chat_history'
};

// 登录成功后的 page title 特征
const SUCCESS_TITLES = ['拼多多 商家后台', '首页', '订单查询'];

// 浏览器数据存储目录
const BROWSER_DATA_DIR = path.join(__dirname, '..', 'browser_data');

/**
 * 生成 request_id（模拟拼多多的格式）
 */
function generateRequestId() {
  return 'flowai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
}

/**
 * 保存店铺的 Cookie
 */
function saveStoreCookies(storeId, cookies) {
  const cookieDir = path.join(BROWSER_DATA_DIR, 'store_' + storeId);
  if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true });
  fs.writeFileSync(path.join(cookieDir, 'cookies.json'), JSON.stringify(cookies, null, 2));
  return cookieDir;
}

/**
 * 加载店铺的 Cookie
 */
function loadStoreCookies(storeId) {
  const cookieFile = path.join(BROWSER_DATA_DIR, 'store_' + storeId, 'cookies.json');
  if (!fs.existsSync(cookieFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
  } catch (e) {
    return null;
  }
}

/**
 * 检查店铺 Cookie 是否有效
 */
async function checkCookieValid(cookies) {
  if (!cookies || !cookies.length) return false;

  try {
    const cookieStr = cookies.map(c => c.name + '=' + c.value).join('; ');
    const res = await fetch(PDD.HOME_URL, {
      headers: { 'Cookie': cookieStr },
      redirect: 'manual'
    });

    // 如果跳转到 login 页面，说明 Cookie 失效
    if (res.status === 302) {
      const location = res.headers.get('location') || '';
      if (location.includes('login')) return false;
    }
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

/**
 * 发送文本消息到拼多多买家
 * @param {string} cookies - Cookie 字符串
 * @param {string} recipientUid - 买家 UID
 * @param {string} content - 消息内容
 */
async function sendTextMessage(cookies, recipientUid, content) {
  const cookieStr = Array.isArray(cookies)
    ? cookies.map(c => c.name + '=' + c.value).join('; ')
    : cookies;

  const data = {
    data: {
      cmd: 'send_message',
      request_id: generateRequestId(),
      message: {
        to: { role: 'user', uid: recipientUid },
        from: { role: 'mall_cs' },
        content: content,
        msg_id: null,
        type: 0,
        is_aut: 0,
        manual_reply: 1
      }
    },
    client: 'WEB'
  };

  try {
    const res = await fetch(PDD.SEND_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieStr,
        'Referer': 'https://mms.pinduoduo.com/chat-merchant/index.html'
      },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) return { success: true, result };

    // 检查业务错误码
    const inner = result.result || {};
    if (inner.error_code === 10002) {
      return { success: false, error: inner.error || '发送失败' };
    }
    return { success: false, error: '发送失败' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * 发送图片消息
 */
async function sendImageMessage(cookies, recipientUid, imageUrl) {
  const cookieStr = Array.isArray(cookies)
    ? cookies.map(c => c.name + '=' + c.value).join('; ')
    : cookies;

  const data = {
    data: {
      cmd: 'send_message',
      request_id: generateRequestId(),
      message: {
        to: { role: 'user', uid: recipientUid },
        from: { role: 'mall_cs' },
        content: imageUrl,
        msg_id: null,
        chat_type: 'cs',
        type: 1,
        is_aut: 0,
        manual_reply: 1
      }
    },
    client: 'WEB'
  };

  try {
    const res = await fetch(PDD.SEND_IMAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookieStr,
        'Referer': 'https://mms.pinduoduo.com/chat-merchant/index.html'
      },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return { success: result.success || false, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

module.exports = {
  PDD,
  generateRequestId,
  saveStoreCookies,
  loadStoreCookies,
  checkCookieValid,
  sendTextMessage,
  sendImageMessage,
  BROWSER_DATA_DIR
};
