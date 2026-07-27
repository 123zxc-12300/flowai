// FlowAI 流智 — 拼多多开放平台 API（正规合规方案）
// 文档：https://open.pinduoduo.com/
// 网关：https://gw-api.pinduoduo.com/api/router

const crypto = require('crypto');
const { getDB } = require('../db');

// 开放平台配置
const PDD_OPEN = {
  GATEWAY: 'https://gw-api.pinduoduo.com/api/router',
  AUTH_URL: 'https://mms.pinduoduo.com/open.html',
  TOKEN_URL: 'https://open-api.pinduoduo.com/oauth/token',
};

/**
 * MD5 签名（拼多多开放平台签名算法）
 * 规则：所有参数按 key 字母升序排列 → key1value1key2value2... → 首尾拼接 secret → MD5 大写
 */
function generateSign(params, clientSecret) {
  // 按 key 字母升序排列
  const sortedKeys = Object.keys(params).sort();
  // 拼接 key+value
  const raw = sortedKeys.map(k => k + params[k]).join('');
  // 首尾加 secret
  const signStr = clientSecret + raw + clientSecret;
  // MD5 大写
  return crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();
}

/**
 * 调用拼多多开放平台 API
 */
async function callApi(apiType, businessParams, accessToken, clientId, clientSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const params = {
    type: apiType,
    client_id: clientId,
    timestamp: timestamp,
    data_type: 'JSON',
    access_token: accessToken,
    ...businessParams
  };

  // 生成签名
  params.sign = generateSign(params, clientSecret);

  // 将参数转为 form body
  const formBody = new URLSearchParams(params).toString();

  try {
    const res = await fetch(PDD_OPEN.GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody
    });
    return await res.json();
  } catch (e) {
    return { error_response: { error_msg: e.message } };
  }
}

/**
 * 通过 OAuth2.0 授权 code 换取 access_token
 * 使用场景：用户授权后的回调中拿到 code，换取 token
 */
async function getAccessToken(code, clientId, clientSecret, redirectUri) {
  const response = await fetch(PDD_OPEN.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    })
  });
  return await response.json();
}

/**
 * 刷新 access_token
 */
async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const response = await fetch(PDD_OPEN.TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  return await response.json();
}

// ====================================
// 常用 API 封装
// ====================================

/**
 * 获取店铺信息
 * API: pdd.pop.auth.info.get
 */
async function getShopInfo(storeId) {
  const cred = getPDDCredentials(storeId);
  if (!cred) return { error: '店铺未配置开放平台凭证' };

  return await callApi('pdd.pop.auth.info.get', {}, cred.accessToken, cred.clientId, cred.clientSecret);
}

/**
 * 查询订单列表
 * API: pdd.order.list.get
 */
async function getOrderList(storeId, params = {}) {
  const cred = getPDDCredentials(storeId);
  if (!cred) return { error: '店铺未配置开放平台凭证' };

  return await callApi('pdd.order.list.get', {
    order_status: params.orderStatus || '1',
    page: params.page || '1',
    page_size: params.pageSize || '20'
  }, cred.accessToken, cred.clientId, cred.clientSecret);
}

/**
 * 获取物流单号
 * API: pdd.logistics.companies.get
 */
async function getLogisticsCompanies(storeId) {
  const cred = getPDDCredentials(storeId);
  if (!cred) return { error: '店铺未配置开放平台凭证' };

  return await callApi('pdd.logistics.companies.get', {}, cred.accessToken, cred.clientId, cred.clientSecret);
}

/**
 * 查询商品列表
 * API: pdd.goods.list.get
 */
async function getGoodsList(storeId, params = {}) {
  const cred = getPDDCredentials(storeId);
  if (!cred) return { error: '店铺未配置开放平台凭证' };

  return await callApi('pdd.goods.list.get', {
    page: params.page || '1',
    page_size: params.pageSize || '20',
    is_onsale: params.isOnsale || '1'
  }, cred.accessToken, cred.clientId, cred.clientSecret);
}

// ====================================
// 凭证管理
// ====================================

/**
 * 保存开放平台凭证
 */
function savePDDCredentials(storeId, userId, credentials) {
  const db = getDB();

  // 检查是否已存在
  const existing = db.get('SELECT * FROM store_platform_credentials WHERE store_id = ? AND platform = ?',
    [storeId, 'pinduoduo']);

  if (existing) {
    db.run(`UPDATE store_platform_credentials
      SET client_id=?, client_secret=?, access_token=?, refresh_token=?,
        expires_at=?, scope=?, updated_at=CURRENT_TIMESTAMP
      WHERE store_id=? AND platform=?`,
      [credentials.clientId || '', credentials.clientSecret || '',
       credentials.accessToken || '', credentials.refreshToken || '',
       credentials.expiresAt || null, credentials.scope || '{}',
       storeId, 'pinduoduo']);
  } else {
    db.run(`INSERT INTO store_platform_credentials
      (store_id, user_id, platform, client_id, client_secret, access_token, refresh_token, expires_at, scope)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [storeId, userId, 'pinduoduo',
       credentials.clientId || '', credentials.clientSecret || '',
       credentials.accessToken || '', credentials.refreshToken || '',
       credentials.expiresAt || null, credentials.scope || '{}']);
  }

  return { success: true };
}

/**
 * 获取开放平台凭证
 */
function getPDDCredentials(storeId) {
  const db = getDB();
  const cred = db.get(
    'SELECT * FROM store_platform_credentials WHERE store_id = ? AND platform = ?',
    [storeId, 'pinduoduo']
  );
  if (!cred) return null;

  return {
    clientId: cred.client_id,
    clientSecret: cred.client_secret,
    accessToken: cred.access_token,
    refreshToken: cred.refresh_token,
    expiresAt: cred.expires_at,
    scope: cred.scope,
    updatedAt: cred.updated_at
  };
}

/**
 * 生成 OAuth 授权链接
 */
function generateAuthUrl(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state: state || 'flowai_' + Date.now()
  });
  return PDD_OPEN.AUTH_URL + '?' + params.toString();
}

module.exports = {
  PDD_OPEN,
  generateSign,
  callApi,
  getAccessToken,
  refreshAccessToken,
  getShopInfo,
  getOrderList,
  getLogisticsCompanies,
  getGoodsList,
  savePDDCredentials,
  getPDDCredentials,
  generateAuthUrl
};
