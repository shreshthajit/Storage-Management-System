const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name:String,
    email: String,
    password: String,
    googleId: String
  },
  {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

const User = mongoose.model('User', userSchema);
module.exports = { User };
