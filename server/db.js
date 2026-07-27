// FlowAI 流智 — 数据库模块（使用 sql.js，纯 JS 无编译依赖）
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = process.env.DB_PATH || path.join(dataDir, 'flowai.db');

let db = null;

// sql.js 的 API 包装层，模拟 better-sqlite3 风格
function wrapDatabase(sqlDb) {
  return {
    // 基础执行
    exec(sql) {
      sqlDb.run(sql);
      // 保存到文件
      const data = sqlDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      return this;
    },
    // 带参数执行（写入）
    run(sql, params = []) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {} // 执行完毕
      stmt.free();
      // 保存到文件
      const data = sqlDb.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
      return { changes: sqlDb.getRowsModified() };
    },
    // 查询单行（返回对象）
    get(sql, params = []) {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return undefined;
    },
    // 查询多行（返回对象数组）
    all(sql, params = []) {
      const results = [];
      const stmt = sqlDb.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    },
    // 获取原始 sql.js 实例（用于特殊操作）
    raw() {
      return sqlDb;
    }
  };
}

// 初始化数据库（异步）
async function initDB() {
  const SQL = await initSqlJs();

  // 尝试从文件加载已有数据库
  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  db = wrapDatabase(sqlDb);

  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      total_used REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      credits REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      task_type TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost REAL DEFAULT 0,
      status TEXT DEFAULT 'success',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS verify_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cookie 存储表
    CREATE TABLE IF NOT EXISTS store_cookies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      cookie_data TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 开放平台凭证表
    CREATE TABLE IF NOT EXISTS store_platform_credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      platform TEXT NOT NULL DEFAULT 'pinduoduo',
      client_id TEXT DEFAULT '',
      client_secret TEXT DEFAULT '',
      access_token TEXT DEFAULT '',
      refresh_token TEXT DEFAULT '',
      expires_at DATETIME,
      scope TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(store_id, platform)
    );

    -- 店铺表
    CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'pinduoduo',
      shop_name TEXT NOT NULL DEFAULT '',
      products TEXT DEFAULT '',
      reply_tone TEXT DEFAULT '热情亲切',
      refund_policy TEXT DEFAULT '',
      shipping_info TEXT DEFAULT '',
      knowledge_base TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log('[DB] 数据库初始化完成');
  return db;
}

module.exports = { initDB, getDB: () => db };
