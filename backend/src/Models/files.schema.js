const { boolean } = require('joi');
const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      index: true,
    },
    fileType: String,
    fileSize: String,
    fileExtension: String,
    favourite: { type: Boolean, default: false },
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'folder', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        permission: { type: String, enum: ['read', 'readWrite'] },
      },
    ],
    accessLogs: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, accessTime: Date }],
    sharedLinks: [{ link: { type: String, index: true }, created_at: { type: Date, default: Date.now } }],
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const File = mongoose.model('file', fileSchema);
module.exports = { File };
