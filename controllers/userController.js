const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
    try {
        const { name, username, password } = req.body;
        const existing = await User.findOne({ username });
        if (existing) return json({ status: 400, message: 'Username đã tồn tại' });

        const hash = await bcrypt.hash(password, 10);
        const user = new User({ name, username, password: hash });
        await user.save();
        res.json({ status: 200, message: 'Đăng ký thành công', user });
    } catch (err) {
        res.json({ status: 500, message: 'Lỗi server', error: err.message });
    }
};

exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.json({ status: 400, message: 'Sai tài khoản hoặc mật khẩu' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.json({ status: 400, message: 'Sai tài khoản hoặc mật khẩu' });

        // Tạo token JWT
        const token = jwt.sign(
            { id: user._id, username: user.username },
            'tienlen_secret',
            { expiresIn: '7d' }
        );

        const data = {
            id: user._id,
            name: user.name,
            username: user.username,
            score: user.score,
            token: token,
        };

        res.json({ status: 200, message: 'Đăng nhập thành công', data: data });
    } catch (err) {
        res.json({ status: 500, message: 'Lỗi server', error: err.message });
    }
};

exports.getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'Không tìm thấy user' });
        res.json(user);
    } catch (err) {
        res.json({ status: 500, message: 'Lỗi server', error: err.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        await User.findByIdAndDelete(id);
        res.json({ status: 200, message: 'Xóa user thành công' });
    } catch (err) {
        res.json({ status: 500, message: 'Lỗi server', error: err.message });
    }
};

exports.editUser = async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;
        if (update.password) {
            update.password = await bcrypt.hash(update.password, 10);
        }
        const user = await User.findByIdAndUpdate(id, update, { new: true });
        res.json({ status: 200, message: 'Cập nhật thành công', user });
    } catch (err) {
        res.json({ status: 500, message: 'Lỗi server', error: err.message });
    }
};
