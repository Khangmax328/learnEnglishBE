const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/UserModel');
const Text = require('../models/TextModel'); 

const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email đã được sử dụng' });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({ username, email, password: hashed });

    res.status(201).json({ message: 'Đăng ký thành công', userId: newUser._id });
  } catch (err) {
    res.status(500).json({ message: 'Đăng ký thất bại', error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email không tồn tại' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Sai mật khẩu' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isAdmin: !!user.isAdmin,  
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Chỉ admin mới được phép xem danh sách user' });
    }

    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip  = (page - 1) * limit;
    const keyword = (req.query.keyword || '').trim();

    const cond = keyword
      ? {
          $or: [
            { username: { $regex: keyword, $options: 'i' } },
            { email:    { $regex: keyword, $options: 'i' } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      User.find(cond)
        .select('_id username email isAdmin createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(cond),
    ]);

    res.json({
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
const updateUser = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Chỉ admin mới được phép cập nhật user' });
    }

    const { id } = req.params;
    const { username, email, isAdmin } = req.body;
    if (String(id) === String(req.user._id) && isAdmin !== undefined) {
      return res.status(400).json({ message: 'Không thể thay đổi quyền admin của chính mình' });
    }

    const payload = {};
    if (username !== undefined) payload.username = username;
    if (email !== undefined) payload.email = email;
    if (isAdmin !== undefined) payload.isAdmin = isAdmin;

    const updated = await User.findByIdAndUpdate(
      id,
      payload,
      { new: true, runValidators: true, select: '_id username email isAdmin createdAt' }
    );

    if (!updated) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({ message: 'Cập nhật thành công', user: updated });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};



const deleteUser = async (req, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ message: 'Chỉ admin mới được phép xóa user' });
    }

    const { id } = req.params;

    if (String(id) === String(req.user._id)) {
      return res.status(400).json({ message: 'Không thể tự xoá chính mình' });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ message: 'Không tìm thấy user' });

    res.json({ message: 'Xóa thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const me = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Unauthenticated' });

    const user = await User.findById(req.user._id).select('_id username email isAdmin createdAt');
    if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });

    const totalTexts = await Text.countDocuments({ user: user._id });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      isAdmin: !!user.isAdmin,
      createdAt: user.createdAt,
      totalTexts,          
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi server', error: err.message });
  }
};
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Thiếu mật khẩu' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy user' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    return res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};


module.exports = { register, login, updateUser, deleteUser, me, changePassword, getAllUsers  };
