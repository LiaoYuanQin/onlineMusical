const express = require('express');
const router = express.Router();
const { auth, adminAuth } = require('../middleware/auth');
const {
  registerUser,
  loginUser,
  getUsers,
  approveUser,
  rejectUser,
  deleteUser
} = require('../controllers/userController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/users', adminAuth, getUsers);
router.put('/users/:userId/approve', adminAuth, approveUser);
router.put('/users/:userId/reject', adminAuth, rejectUser);
router.delete('/users/:userId', adminAuth, deleteUser);

module.exports = router;