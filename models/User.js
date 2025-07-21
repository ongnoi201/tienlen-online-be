const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    image: { type: String, default: 'https://pngmagic.com/image_small/wide-angle-nature-background-images-free_HIG.webp' },
    score: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
