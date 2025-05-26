const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    name: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'folder', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    favourite: { type: Boolean, default: false },
    sharedWith: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        permission: { type: String, enum: ['read', 'readWrite'] },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const Folder = mongoose.model('folder', folderSchema);
module.exports = { Folder };
