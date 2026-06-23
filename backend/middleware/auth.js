const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未授权访问' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: '未授权访问' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'token无效' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未授权访问' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: '管理员权限不足' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'token无效' });
  }
};

module.exports = { auth, adminAuth };