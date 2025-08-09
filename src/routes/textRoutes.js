const express = require('express');
const {
  addText, getAllTexts, getTextById,
  deleteText, addContribution, deleteContribution,
  getMyTexts
} = require('../controllers/textController');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();
router.get('/me', protect, getMyTexts);
router.get('/', getAllTexts);               
router.get('/:id', getTextById);    
router.post('/', protect, addText);           
router.delete('/:id', protect, deleteText);   

router.post('/:id/contributions', protect, addContribution);               
router.delete('/:id/contributions/:cid', protect, deleteContribution);     
module.exports = router;
