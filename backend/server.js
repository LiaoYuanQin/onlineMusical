const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const JWT_SECRET = 'knowledge_sharing_jwt_secret_key';
const KNOWLEDGE_DIR = path.join(__dirname, '../knowledge');

if (!fs.existsSync(KNOWLEDGE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

let users = [];
let knowledge = [];
let userIdCounter = 1;
let knowledgeIdCounter = 1;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

const saveKnowledgeToFile = (item) => {
  const mdContent = `---
title: "${item.title}"
description: "${item.description}"
tags: ${JSON.stringify(item.tags)}
author: ${item.author}
createdAt: ${item.createdAt}
updatedAt: ${item.updatedAt}
---

# ${item.title}

## 描述

${item.description}

## 正文

${item.content}

${item.files.length > 0 ? '## 附件\n\n' + item.files.map(f => `- [${f.originalName}](/uploads/${f.filename})`).join('\n') : ''}
`;
  fs.writeFileSync(path.join(KNOWLEDGE_DIR, `${item.id}.md`), mdContent);
};

const loadKnowledgeFromFiles = () => {
  try {
    const files = fs.readdirSync(KNOWLEDGE_DIR);
    files.forEach(file => {
      if (file.endsWith('.md')) {
        const id = parseInt(file.replace('.md', ''));
        if (!isNaN(id) && !knowledge.find(k => k.id === id)) {
          const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), 'utf8');
          const match = content.match(/---\n([\s\S]*?)\n---/);
          if (match) {
            const meta = match[1];
            const titleMatch = meta.match(/title:\s*"(.*?)"/);
            const descMatch = meta.match(/description:\s*"(.*?)"/);
            const tagsMatch = meta.match(/tags:\s*(.*)/);
            const authorMatch = meta.match(/author:\s*(\d+)/);
            const createdAtMatch = meta.match(/createdAt:\s*(.*)/);
            const updatedAtMatch = meta.match(/updatedAt:\s*(.*)/);
            
            const body = content.replace(/---[\s\S]*?---\n*/, '');
            const bodyMatch = body.match(/## 正文\n\n([\s\S]*?)(\n## |$)/);
            const contentText = bodyMatch ? bodyMatch[1].trim() : '';
            
            knowledge.push({
              id,
              title: titleMatch ? titleMatch[1] : '',
              description: descMatch ? descMatch[1] : '',
              content: contentText,
              tags: tagsMatch ? JSON.parse(tagsMatch[1]) : [],
              author: authorMatch ? parseInt(authorMatch[1]) : 1,
              files: [],
              createdAt: createdAtMatch ? new Date(createdAtMatch[1]) : new Date(),
              updatedAt: updatedAtMatch ? new Date(updatedAtMatch[1]) : new Date()
            });
            
            if (id >= knowledgeIdCounter) {
              knowledgeIdCounter = id + 1;
            }
          }
        }
      }
    });
  } catch (err) {
    console.log('No existing knowledge files found');
  }
};

loadKnowledgeFromFiles();

const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未授权访问' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ message: '未授权访问' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'token无效' });
  }
};

const adminAuth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: '未授权访问' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = users.find(u => u.id === decoded.id);
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: '管理员权限不足' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'token无效' });
  }
};

const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

const initAdmin = async () => {
  const adminExists = users.find(u => u.email === 'admin@example.com');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    users.push({
      id: userIdCounter++,
      username: 'admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'admin',
      status: 'approved',
      createdAt: new Date()
    });
    console.log('Admin user created');
  }
};

initAdmin();

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const userExists = users.find(u => u.email === email);
    if (userExists) {
      return res.status(400).json({ message: '用户已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = {
      id: userIdCounter++,
      username,
      email,
      password: hashedPassword,
      role: 'author',
      status: 'pending',
      createdAt: new Date()
    };
    
    users.push(user);
    
    res.status(201).json({
      message: '注册成功，请等待管理员审核',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(400).json({ message: '用户不存在' });
    }

    if (user.status !== 'approved') {
      return res.status(400).json({ message: '用户未通过审核' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: '密码错误' });
    }

    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status
    };

    res.json({
      token: generateToken(user.id),
      user: userData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/users', adminAuth, (req, res) => {
  const usersWithoutPassword = users.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt
  }));
  res.json(usersWithoutPassword);
});

app.put('/api/users/:userId/approve', adminAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  user.status = 'approved';
  
  res.json({ message: '审核通过', user });
});

app.put('/api/users/:userId/reject', adminAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  
  if (!user) {
    return res.status(404).json({ message: '用户不存在' });
  }

  user.status = 'rejected';
  
  res.json({ message: '审核拒绝', user });
});

app.delete('/api/users/:userId', adminAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  const index = users.findIndex(u => u.id === userId);
  
  if (index === -1) {
    return res.status(404).json({ message: '用户不存在' });
  }

  users.splice(index, 1);
  
  res.json({ message: '用户已删除' });
});

app.post('/api/knowledge', auth, upload.array('files', 10), (req, res) => {
  try {
    const { title, description, content, tags } = req.body;
    
    const files = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      type: file.mimetype
    })) : [];

    const item = {
      id: knowledgeIdCounter++,
      title,
      description,
      content,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      author: req.user.id,
      files,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    knowledge.push(item);
    saveKnowledgeToFile(item);

    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/knowledge', auth, (req, res) => {
  const result = knowledge.map(item => {
    const author = users.find(u => u.id === item.author);
    return {
      ...item,
      author: author ? { username: author.username, email: author.email, _id: author.id } : null
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  res.json(result);
});

app.get('/api/knowledge/search', auth, (req, res) => {
  const { keyword } = req.query;
  
  if (!keyword) {
    return res.status(400).json({ message: '请输入搜索关键词' });
  }

  const searchLower = keyword.toLowerCase();
  
  const result = knowledge
    .filter(item => 
      item.title.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower) ||
      item.content.toLowerCase().includes(searchLower)
    )
    .map(item => {
      const author = users.find(u => u.id === item.author);
      return {
        ...item,
        author: author ? { username: author.username, email: author.email, _id: author.id } : null
      };
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(result);
});

app.get('/api/knowledge/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const item = knowledge.find(k => k.id === id);
  
  if (!item) {
    return res.status(404).json({ message: '知识不存在' });
  }

  const author = users.find(u => u.id === item.author);
  res.json({
    ...item,
    author: author ? { username: author.username, email: author.email, _id: author.id } : null
  });
});

app.put('/api/knowledge/:id', auth, upload.array('files', 10), (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, content, tags } = req.body;
  
  const itemIndex = knowledge.findIndex(k => k.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ message: '知识不存在' });
  }

  const item = knowledge[itemIndex];

  if (req.user.role !== 'admin' && item.author !== req.user.id) {
    return res.status(403).json({ message: '无权修改他人知识' });
  }

  const files = req.files ? req.files.map(file => ({
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    type: file.mimetype
  })) : [];

  knowledge[itemIndex] = {
    ...item,
    title,
    description,
    content,
    tags: tags ? tags.split(',').map(t => t.trim()) : [],
    files: files.length > 0 ? files : item.files,
    updatedAt: new Date()
  };

  saveKnowledgeToFile(knowledge[itemIndex]);

  const updatedItem = knowledge[itemIndex];
  const author = users.find(u => u.id === updatedItem.author);
  
  res.json({
    ...updatedItem,
    author: author ? { username: author.username, email: author.email, _id: author.id } : null
  });
});

app.delete('/api/knowledge/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const itemIndex = knowledge.findIndex(k => k.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({ message: '知识不存在' });
  }

  const item = knowledge[itemIndex];

  if (req.user.role !== 'admin' && item.author !== req.user.id) {
    return res.status(403).json({ message: '无权删除他人知识' });
  }

  knowledge.splice(itemIndex, 1);
  
  const filePath = path.join(KNOWLEDGE_DIR, `${id}.md`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  res.json({ message: '知识已删除' });
});

app.use(express.static(path.join(__dirname, '../frontend/public')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Knowledge files saved to: ${KNOWLEDGE_DIR}`);
});