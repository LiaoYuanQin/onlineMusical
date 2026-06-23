const Knowledge = require('../models/Knowledge');

const createKnowledge = async (req, res) => {
  try {
    const { title, description, content, tags } = req.body;
    
    const files = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      type: file.mimetype
    })) : [];

    const knowledge = await Knowledge.create({
      title,
      description,
      content,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      author: req.user._id,
      files
    });

    res.status(201).json(knowledge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllKnowledge = async (req, res) => {
  try {
    const knowledge = await Knowledge.find()
      .populate('author', 'username email')
      .sort({ createdAt: -1 });
    
    res.json(knowledge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getKnowledgeById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const knowledge = await Knowledge.findById(id)
      .populate('author', 'username email');
    
    if (!knowledge) {
      return res.status(404).json({ message: '知识不存在' });
    }

    res.json(knowledge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, tags } = req.body;
    
    const knowledge = await Knowledge.findById(id);
    
    if (!knowledge) {
      return res.status(404).json({ message: '知识不存在' });
    }

    if (req.user.role !== 'admin' && knowledge.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权修改他人知识' });
    }

    const files = req.files ? req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      type: file.mimetype
    })) : [];

    const updatedKnowledge = await Knowledge.findByIdAndUpdate(
      id,
      {
        title,
        description,
        content,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        files: files.length > 0 ? files : knowledge.files,
        updatedAt: Date.now
      },
      { new: true }
    ).populate('author', 'username email');

    res.json(updatedKnowledge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    
    const knowledge = await Knowledge.findById(id);
    
    if (!knowledge) {
      return res.status(404).json({ message: '知识不存在' });
    }

    if (req.user.role !== 'admin' && knowledge.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: '无权删除他人知识' });
    }

    await Knowledge.findByIdAndDelete(id);
    
    res.json({ message: '知识已删除' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const searchKnowledge = async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ message: '请输入搜索关键词' });
    }

    const knowledge = await Knowledge.find({
      $text: { $search: keyword }
    })
    .populate('author', 'username email')
    .sort({ score: { $meta: 'textScore' }, createdAt: -1 });

    res.json(knowledge);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createKnowledge,
  getAllKnowledge,
  getKnowledgeById,
  updateKnowledge,
  deleteKnowledge,
  searchKnowledge
};