const express = require('express');
const { register, login, updateUser, deleteUser, me, changePassword, getAllUsers } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/me', protect, me);

router.get('/users', protect, getAllUsers);

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', protect, changePassword);
router.put('/:id', protect  , updateUser);
router.delete('/users/:id', protect, deleteUser);
router.patch('/users/:id', protect, updateUser);

module.exports = router;
