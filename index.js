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
    origin: 'https://tienlen-online.vercel.app',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true 
};

app.use(cors(corsOptions));

mongoose.connect('mongodb+srv://tienlen:uFQnxTgpca4a4yyE@tienlen.b7dlfm7.mongodb.net/?retryWrites=true&w=majority&appName=tienlen', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB error:', err));

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.json({ status: 400, message: 'Chưa đăng nhập' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.json({ status: 400, message: 'Chưa đăng nhập' });
    try {
        const decoded = jwt.verify(token, 'tienlen_secret');
        req.user = decoded;
        next();
    } catch (err) {
        return res.json({ status: 500, message: 'Chưa đăng nhập' });
    }
}

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
    socket.on('init_player', (data) => {
        const { token } = data || {};

        try {
            const decoded = jwt.verify(token, 'tienlen_secret');
            const userId = decoded.id;
            if (!userId) return;
            gameManager.handleConnection(socket, { userId });

        } catch (err) {
            console.log('JWT verification failed:', err);
        }
    });
});



server.listen(3001, () => {
    console.log('Server running');
});
