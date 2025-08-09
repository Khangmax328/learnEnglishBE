const Text = require('../models/TextModel');
const { correctWithAI, translateToVi } = require('../services/aiService'); 

function pickContribPage(all = [], cpage = 1, climit = 3) {
  const page  = Math.max(parseInt(cpage)  || 1, 1);
  const limit = Math.min(parseInt(climit) || 3, 100);
  const total = all.length;
  const sorted = [...all].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const slice = sorted.slice((page - 1) * limit, (page - 1) * limit + limit);
  return {
    list: slice,
    meta: {
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    }
  };
}

const addText = async (req, res) => {
  try {
    const { userText } = req.body;
    if (!userText || !userText.trim()) {
      return res.status(400).json({ message: 'Thiếu userText' });
    }
    const clean = userText.trim();
    const doc = await Text.create({
      user: req.user._id,
      userText: clean
    });

    const corrected = await correctWithAI(clean);
    doc.correctedText = corrected || null;

    try {
      if (corrected) {
        const vi = await translateToVi(corrected);
        doc.correctedTextVi = (vi || '').trim() || null;
      }
    } catch (e) {
      console.warn('translateToVi failed:', e.message);
    }

    doc.correctedBy = 'AI';
    doc.correctionDate = new Date();
    await doc.save();

    return res.status(201).json(doc);
  } catch (err) {
    return res.status(502).json({ message: 'AI correction failed', error: err.message });
  }
};

/* ===== GET /texts?page&limit&cpage&climit ===== */
const getAllTexts = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip  = (page - 1) * limit;

    const cpage  = req.query.cpage;
    const climit = req.query.climit;

    const [raw, total] = await Promise.all([
      Text.find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username email')
        .populate('contributions.user', 'username email'),
      Text.countDocuments({})
    ]);

    const items = raw.map(doc => {
      const obj = doc.toObject();
      const { list, meta } = pickContribPage(obj.contributions, cpage, climit);
      obj.contributions = list;
      obj.contrib = meta;
      return obj;
    });

    res.json({
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ===== GET /texts/me?page&limit&cpage&climit ===== */
const getMyTexts = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const skip  = (page - 1) * limit;

    const cpage  = req.query.cpage;
    const climit = req.query.climit;

    const filter = { user: req.user._id };

    const [raw, total] = await Promise.all([
      Text.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username email')
        .populate('contributions.user', 'username email'),
      Text.countDocuments(filter)
    ]);

    const items = raw.map(doc => {
      const obj = doc.toObject();
      const { list, meta } = pickContribPage(obj.contributions, cpage, climit);
      obj.contributions = list;
      obj.contrib = meta;
      return obj;
    });

    res.json({
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ===== GET /texts/:id?cpage&climit ===== */
const getTextById = async (req, res) => {
  try {
    const { id } = req.params;
    const cpage  = Math.max(parseInt(req.query.cpage)  || 1, 1);
    const climit = Math.min(parseInt(req.query.climit) || 10, 100);
    const start  = (cpage - 1) * climit;

    const text = await Text.findById(id)
      .populate('user', 'username email')
      .populate('contributions.user', 'username email');

    if (!text) return res.status(404).json({ message: 'Không tìm thấy bài' });

    const canDelete = req.user
      ? (text.user._id.toString() === req.user._id.toString() || !!req.user.isAdmin)
      : false;

    const totalContrib = text.contributions.length;
    const contribSorted = [...text.contributions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    const contribPage = contribSorted.slice(start, start + climit);

    const { contributions, ...rest } = text.toObject();
    res.json({
      item: { ...rest, canDelete },
      contributions: contribPage,
      contrib: {
        total: totalContrib,
        page: cpage,
        pageSize: climit,
        totalPages: Math.max(1, Math.ceil(totalContrib / climit)),
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ===== DELETE /texts/:id ===== */
const deleteText = async (req, res) => {
  try {
    const { id } = req.params;
    const text = await Text.findById(id);
    if (!text) return res.status(404).json({ message: 'Không tìm thấy bài' });

    const isOwner = text.user.toString() === req.user._id.toString();
    if (!isOwner && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Không có quyền xóa bài này' });
    }

    await text.deleteOne();
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ===== POST /texts/:id/contributions ===== */
const addContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { suggestion } = req.body;
    if (!suggestion || !suggestion.trim()) {
      return res.status(400).json({ message: 'Thiếu suggestion' });
    }

    const text = await Text.findById(id);
    if (!text) return res.status(404).json({ message: 'Không tìm thấy bài' });

    const newItem = {
      user: req.user._id,
      suggestion: suggestion.trim(),
    };
    text.contributions.push(newItem);
    await text.save();

    await text.populate({ path: 'contributions.user', select: 'username email' });

    const contrib = text.contributions[text.contributions.length - 1];

    return res.status(201).json({
      message: 'Đã thêm góp ý',
      contribution: {
        _id: contrib._id,
        suggestion: contrib.suggestion,
        createdAt: contrib.createdAt,
        user: {
          _id: contrib.user._id,
          username: contrib.user.username,
          email: contrib.user.email,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/* ===== DELETE /texts/:id/contributions/:cid ===== */
const deleteContribution = async (req, res) => {
  try {
    const { id, cid } = req.params;
    const text = await Text.findById(id);
    if (!text) return res.status(404).json({ message: 'Không tìm thấy bài' });

    const item = text.contributions.id(cid);
    if (!item) return res.status(404).json({ message: 'Không tìm thấy góp ý' });

    const isOwner = item.user.toString() === req.user._id.toString();
    if (!isOwner && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Không có quyền xóa góp ý này' });
    }

    item.deleteOne();
    await text.save();
    res.json({ message: 'Đã xóa góp ý' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  addText,
  getAllTexts,
  getTextById,
  deleteText,
  addContribution,
  deleteContribution,
  getMyTexts
};
