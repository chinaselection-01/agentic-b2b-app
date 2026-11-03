# agentic-b2b-app

托管版「智能体撮合」MVP —— 把 seller / buyer 两个开源 Agent 的引擎包成一个网页产品。

**视频号引流 → 卖家打开网页填表即上线智能体 → 买家在目录里搜到直接聊。**
买卖双方都是 AI：卖家 Agent 从自己填的知识库回答，买家 Agent（网页侧）发询盘、做初筛。
涉及价格 / 合同 / 付款的问询自动转人工并给联系方式。

## 和那两个开源仓库的关系

- `agentic-b2b-seller` / `agentic-b2b-buyer` = **引擎/源码**：技术伙伴自己 clone 跑、互相对接。
- `agentic-b2b-app` = **成品**：非技术用户（工厂老板、采购商）不用碰代码，打开网页就能用。

视频号场景用的是这个 app，不是那两个仓库。

## 跑起来

```bash
cd agentic-b2b-app
node server.js          # 默认 http://localhost:3000
```

可选：设 `OPENAI_API_KEY`（或 `OPENAI_BASE_URL` / `OPENAI_MODEL`）让回答升级成真 LLM 自然语言；
不设则走离线关键词 stub，零配置也能演示全流程。

## 用法

1. 打开 `/` → 「我是卖家」→ 填名称 / 主体 / 联系邮箱 / 卖什么 / 知识库(markdown) → 点「上线我的智能体」。
   上线后拿到一张 **能力卡片 URL**，可贴网站、发群里、或给别的买家 Agent 调用。
2. 「我是买家」→ 看到在售卖家目录 → 点一个 → 直接对话询盘。

## 接口（也供外部买家 Agent 调用）

| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/sellers` | 卖家目录 |
| POST | `/api/sellers` | 注册卖家（表单即知识库） |
| GET  | `/api/card/:id` | 该卖家的 Agent 能力卡片 |
| POST | `/api/sellers/:id/inquire` | 向该卖家 Agent 发询盘，返回 KB 回答 + `needsHuman` 标记 |

## 部署提示（视频号落地用）

- 需要一台常驻服务器 + 域名（视频号落地页要备案域名）。
- 最小方案：任意 VPS 跑 `node server.js`，前置 Nginx/Caddy 反代 + HTTPS。
- 数据当前存 `data/sellers.json`（单文件，MVP 够用）；上量后换 SQLite/Postgres。
- 视频号放一条讲解视频 → 挂「点击进入」链接到本 app 域名，卖家/买家进来即用。

## License

MIT
