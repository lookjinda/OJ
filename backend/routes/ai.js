const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// AI Chat 接口 - 配置不同的 AI 提供者
// 支持：doubao（豆包/Doubao）、zhipu（智谱）、openai、claude
// 需要在环境变量或配置中设置对应的 API Key
const AI_CONFIG = {
  provider: process.env.AI_PROVIDER || 'doubao',
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || '',
  baseUrl: process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
};

const PROVIDER_CONFIGS = {
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro-32k',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: (model, messages) => ({ model, messages, stream: false }),
    extract: (data) => data.choices?.[0]?.message?.content || '',
    supportsVision: true,
  },
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: (model, messages) => ({ model, messages, stream: false }),
    extract: (data) => data.choices?.[0]?.message?.content || '',
    supportsVision: true,
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-128k',
    vlModel: 'moonshot-v1-32k-vision-preview',  // 支持图片的视觉模型
    headers: (key) => ({ 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }),
    body: (model, messages) => ({ model, messages, stream: false }),
    extract: (data) => data.choices?.[0]?.message?.content || '',
    supportsVision: true,
  },
};

// 系统提示词 - 编程老师身份
const SYSTEM_PROMPT = `你是「小码老师」，一名专业、耐心、热情的编程老师，专门帮助中小学生学习编程。

你的特点：
- 语言亲切友善，像朋友一样交流，但不失专业
- 擅长用生活中的例子解释抽象概念
- 代码讲解清晰，会给出完整可运行的示例
- 善于引导思考，不直接给答案，而是启发学生自己想出来
- 针对中小学生的知识水平回答，不过于深奥

你擅长教授：
- Python 编程基础
- C++ 编程（NOIP/CSP 竞赛方向）
- Scratch 可视化编程
- 算法与数据结构入门
- 编程题思路讲解

当学生提问时：
1. 先理解学生在问什么，用简短的话确认
2. 给出清晰易懂的解释
3. 提供可运行的代码示例（用代码块包裹）
4. 最后可以问一句"明白了吗"或者"还有疑问吗"

请用中文回答。`;

// 格式化消息为 API 格式（支持文本和图片）
function formatMessage(m) {
  if (m.image) {
    // 图片消息：使用 content 数组格式
    return {
      role: m.role,
      content: [
        { type: 'text', text: m.content || '' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.image}` } },
      ],
    };
  }
  return { role: m.role, content: m.content };
}

// 调用 AI
async function callAI(messages) {
  const config = PROVIDER_CONFIGS[AI_CONFIG.provider] || PROVIDER_CONFIGS.doubao;
  const model = AI_CONFIG.model || config.model;
  const apiKey = AI_CONFIG.apiKey;

  if (!apiKey) {
    return 'AI 服务未配置 API Key，请联系管理员设置环境变量 AI_API_KEY';
  }

  // 检查是否包含图片
  const hasImage = messages.some(m => m.image);

  // 选择模型：图片用 vl 模型，文本用普通模型
  const useModel = hasImage && config.vlModel ? config.vlModel : (AI_CONFIG.model || config.model);

  // 如果有图片但模型不支持，返回提示
  if (hasImage && !config.supportsVision) {
    return '当前 AI 模型不支持图片，请切换到支持多模态的模型';
  }

  const systemMsg = { role: 'system', content: SYSTEM_PROMPT };
  const formattedMessages = messages.map(m => {
    if (m.image) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content || '' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${m.image}` } },
        ],
      };
    }
    // 纯文本：content 必须是字符串，不是数组（Kimi API 要求）
    return { role: m.role, content: m.content };
  });
  const fullMessages = [systemMsg, ...formattedMessages];

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: config.headers(apiKey),
      body: JSON.stringify(config.body(useModel, fullMessages)),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('AI API error:', response.status, err);
      return `AI 服务响应错误 (${response.status})，请稍后重试`;
    }

    const data = await response.json();
    return config.extract(data) || 'AI 暂时没有回答，请换个问题试试';
  } catch (err) {
    console.error('AI call failed:', err);
    return '网络连接失败，请检查网络后重试';
  }
}

// POST /api/ai/chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages 参数无效' });
    }

    // 限制消息长度，防止滥用
    const lastMessages = messages.slice(-20);

    const reply = await callAI(lastMessages);
    res.json({ reply });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// GET /api/ai/status - 检查 AI 服务状态
router.get('/status', (req, res) => {
  const hasKey = !!AI_CONFIG.apiKey;
  res.json({
    configured: hasKey,
    provider: AI_CONFIG.provider,
    model: AI_CONFIG.model || PROVIDER_CONFIGS[AI_CONFIG.provider]?.model,
  });
});

module.exports = router;