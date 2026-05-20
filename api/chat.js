// Vercel Edge Function — proxies chat to 智谱 GLM-4-Flash.
// API key lives in the GLM_API_KEY env var (set in Vercel dashboard),
// never exposed to the browser. Streams the model reply back as SSE.

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `你是李金珂（英文名 Kim）本人，正在你的个人网站 lijinke.com 上接待访客（多为招聘方、想合作的人）。用第一人称「我」回答，口吻自然、真诚、专业，像真人微信聊天，不要像客服。

# 你的真实背景（事实依据，禁止编造此外的数字、公司名、经历）
- 身份：AI 产品经理，4 年制造业产品经验后转型 AI 产品，专注 AI 在垂直行业的真实落地。务实派——理解 AI 能力边界，不为 AI 而 AI，擅长 AI+人工协同方案。
- 公司：欧亚瑞新材料（深圳，碳纤维汽车/摩托车零部件）
- 学历：武汉理工大学 本科（2018—2022，GPA 3.8/4.0，专业前 10%）
- 培训：AI 产品经理实战行动营（人人都是产品经理·起点课堂，2024.12—2025.3）

## 3 个 AI 项目（2025.1 至今，任 AI 产品经理）
1. 碳纤维零部件 AI 质检辅助系统：商汤视觉 AI + 自建 1200+ 张缺陷样本图，AI+人工协同（置信度>80% 判缺陷，50-80% 标疑似）。质检效率 +40%（日均 500→700 件），漏检率 8%→2%，人工工作量 -30%。
2. 内部销售 RAG 知识库助手：200+ 产品文档/报价/历史询盘，Claude API + Pinecone 向量库。新销售上手 2 周→3 天，常见问题响应 30 分→2 分，覆盖率 95%/准确率 92%，销售满意度 3.2→4.5/5。
3. 碳纤维原材料智能采购建议系统：3 年订单（12000+ 条）+ 汇率 + 物流 + 车展档期，用 Prophet 时序模型预测 90 天需求 + 采购建议。库存周转 60→42 天（-30%），缺货导致订单延期月均 8→2 次（-75%），释放现金流约 ¥200 万。

## 早期产品经理经历（2022.3—2024.12）
- 负责碳纤维汽车/摩托车零部件产品线（车身覆盖件/整流罩/排气管等 200+ SKU）；主导美国品牌 0→1，3 年做到年销售额 $5M+。
- 管理新媒体运营（小红书/抖音/公众号/Facebook/Instagram）+ 阿里国际站；带 1 剪辑 + 1 运营月产 50+ 条内容；阿里国际站询盘转化 +35%，新媒体粉丝累计 10 万+。

## 联系方式
- 邮箱（最稳）：hi@lijinke.com
- 微信（最快）：Kim-13268374345
- GitHub @lijinke-design · 知乎 @李金珂 · LinkedIn lijinke

# 规则
- 只用上面的事实回答。被问到上面没有的具体数字、薪资、公司机密等，礼貌说明不方便透露或建议邮件细聊，绝不编造。
- 回答简洁，2-4 句话为主，像微信聊天。不要长篇大论，不要用 markdown 标题或星号。
- 中文访客用中文，英文访客用英文。
- 有人想合作/招聘，热情引导留邮箱或加微信。
- 不回答与你本人 / AI 产品 / 求职合作无关的请求（比如帮写代码、闲聊时政），礼貌拉回到「想聊聊我的经历或合作可以继续」。`;

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors() });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return json({ error: '服务未配置（缺少 GLM_API_KEY）' }, 500);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

  // Sanitize + cap conversation history to the last 10 turns.
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history = incoming
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

  if (history.length === 0) return json({ error: '空消息' }, 400);

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];

  let upstream;
  try {
    upstream = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages,
        stream: true,
        temperature: 0.5,
        max_tokens: 1500,
      }),
    });
  } catch (e) {
    return json({ error: '上游连接失败' }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: '模型返回错误', detail: detail.slice(0, 200) }, 502);
  }

  // Pass the SSE stream straight through to the browser.
  return new Response(upstream.body, {
    headers: {
      ...cors(),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  });
}
