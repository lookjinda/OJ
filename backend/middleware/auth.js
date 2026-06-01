const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'coding-platform-secret-key-2024';
const JWT_EXPIRES = '30d';

module.exports = {
  // 生成Token
  generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  },

  // 验证Token
  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return null;
    }
  },

  // 认证中间件
  authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未登录或登录已过期' });
    }
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded) {
      return res.status(401).json({ error: '无效的Token' });
    }
    req.user = decoded;
    next();
  },

  // 管理员权限中间件
  adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
  }
};
