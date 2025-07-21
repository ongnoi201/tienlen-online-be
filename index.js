const express = require('express');
const mongoose = require('mongoose');
const userController = require('./controllers/userController');
const http = require('http');
const { Server } = require('socket.io');
const GameManager = require('./GameManager');
const jwt = require('jsonwebtoken');

const app = express();
const cors = require('cors');
app.use(express.json());

const corsOptions = {
  origin: 'http://localhost:3000', // Chỉ cho phép từ React app đang chạy ở đây
  methods: ['GET', 'POST', 'PUT', 'DELETE'],        // Giới hạn phương thức
  credentials: true                // Cho phép cookie, token nếu cần
};

app.use(cors(corsOptions));

// Kết nối MongoDB
mongoose.connect('mongodb+srv://tienlen:uFQnxTgpca4a4yyE@tienlen.b7dlfm7.mongodb.net/?retryWrites=true&w=majority&appName=tienlen', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Middleware xác thực
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Chưa đăng nhập' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Thiếu token' });
  try {
    const decoded = jwt.verify(token, 'tienlen_secret');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
}

// User routes
app.post('/api/register', userController.register);
app.post('/api/login', userController.login);
app.get('/api/user/:id', authMiddleware, userController.getUser);
app.delete('/api/user/:id', authMiddleware, userController.deleteUser);
app.put('/api/user/:id', authMiddleware, userController.editUser);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

const gameManager = new GameManager(io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  gameManager.handleConnection(socket);
});

server.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});
