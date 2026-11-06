# agentic-b2b-app

托管版「智能体撮合」MVP —— 把 seller / buyer 两个开源 Agent 的引擎包成一个网页产品。

**视频号引流 → 卖家打开网页填表即上线智能体 → 买家在目录里搜到直接聊。**
买卖双方都是 AI：卖家 Agent 从自己填的知识库回答，买家发询盘、做初筛。
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

LLM 接入（已验证 DeepSeek 可用）：复制 `.env.example` 为 `.env`，填入你的 key：

```bash
OPENAI_API_KEY=你的DeepSeekKey
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-chat

# 注册闸门 + 管理口令
INVITE_CODES=chinaselection,demo
ADMIN_KEY=change-me
```

- 代码走 OpenAI 兼容协议，DeepSeek / OpenAI / 任意兼容端点都行。
- 不设 key 则走离线关键词 stub，零配置也能演示全流程。
- **`.env` 已在 `.gitignore` 中，key 不会进仓库。**

## 功能

1. **真实产品 Demo 数据**：`seed/sellers.json` 含 CedarHaus 木质鸡舍 / Navigator Pet 猫爬架 / SSMugs 保温杯 三条真实产品知识库（HS 编码、产地、材质等按已知事实填写，价格/MOQ 标注「待人工确认」以正确触发转人工）。首次启动若目录为空自动播种。
2. **卖家管理（我的智能体）**：注册后返回 `token` 作为管理凭证（前端存 localStorage）。凭 token 可 `PUT` 编辑、`DELETE` 删除自己的智能体；无 token 或 token 不符返回 403。
3. **注册闸门（防乱注册）**：`POST /api/sellers` 必须带**有效手机号（中国大陆格式）** + **邀请码**（`INVITE_CODES` 之一），否则 400。邀请码通过视频号简介分发。

> 微信扫码 / 短信验证码登录需要公众号（认证 + 备案域名）或短信服务资质，demo 阶段用「手机号 + 邀请码」闸门替代，零外部依赖即可防机器人乱注册。

## 用法

1. 「我是卖家」→ 填名称 / 主体 / 邮箱 / 卖什么 / 语言 / 手机号 / 邀请码 / 知识库 → 点「上线智能体」。
   成功后拿到**管理码（token）**，请复制保存（换设备登录用）。之后在「我的智能体」里可编辑 / 删除。
2. 「我是买家」→ 看到在售卖家目录 → 点一个 → 直接对话询盘；价格/合同类自动转人工并给联系方式。

## 接口

| Method | Path | 说明 |
|--------|------|------|
| GET  | `/api/sellers` | 卖家目录（公开） |
| POST | `/api/sellers` | 注册卖家（需手机号 + 邀请码） |
| GET  | `/api/sellers/:id` | 公开信息；带 `?token=` 返回完整含知识库 |
| PUT  | `/api/sellers/:id` | 编辑（body 带 `token`） |
| DELETE | `/api/sellers/:id` | 删除（body 带 `token`） |
| GET  | `/api/card/:id` | 该卖家的 Agent 能力卡片 |
| POST | `/api/sellers/:id/inquire` | 向该卖家 Agent 发询盘，返回 KB 回答 + `needsHuman` |
| DELETE | `/api/sellers?key=ADMIN_KEY` | 清空全部（demo 重置） |
| POST | `/api/admin/seed?key=ADMIN_KEY` | 重新播种 demo 数据 |

## 部署提示（视频号落地用）

- 已可经 WorkBuddy「发布为应用」一键上线公网，无需自建 VPS。
- 数据当前存 `data/sellers.json`（单文件，MVP 够用）；上量后换 SQLite/Postgres。
- 视频号放一条讲解视频 → 简介放邀请码 → 挂「点击进入」链接到本 app，卖家/买家进来即用。

## License

MIT
