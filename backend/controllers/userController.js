const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: '用户已存在' });
    }

    const user = await User.create({ username, email, password });
    
    res.status(201).json({
      message: '注册成功，请等待管理员审核',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: '用户不存在' });
    }

    if (user.status !== 'approved') {
      return res.status(400).json({ message: '用户未通过审核' });
    }

    const isMatch = await user.matchPassword(password);
    
    if (!isMatch) {
      return res.status(400).json({ message: '密码错误' });
    }

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'approved' },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ message: '审核通过', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const rejectUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { status: 'rejected' },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ message: '审核拒绝', user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByIdAndDelete(userId);
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ message: '用户已删除' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUsers,
  approveUser,
  rejectUser,
  deleteUser
};