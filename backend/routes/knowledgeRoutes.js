const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth } = require('../middleware/auth');
const {
  createKnowledge,
  getAllKnowledge,
  getKnowledgeById,
  updateKnowledge,
  deleteKnowledge,
  searchKnowledge
} = require('../controllers/knowledgeController');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post('/', auth, upload.array('files', 10), createKnowledge);
router.get('/', auth, getAllKnowledge);
router.get('/search', auth, searchKnowledge);
router.get('/:id', auth, getKnowledgeById);
router.put('/:id', auth, upload.array('files', 10), updateKnowledge);
router.delete('/:id', auth, deleteKnowledge);

module.exports = router;