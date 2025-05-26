const jwt = require('jsonwebtoken');
const { User } = require('../Models/users.schema');
const CryptoJS = require('crypto-js');
const {
  HTTP_STATUS_CODE,
  MESSAGE,
  RESPONSE_TITLES,
} = require('../utilities/constants.utils');
require('dotenv').config();
const generateCode = require('../utilities/generet-code.utils');
const { VerificationCode } = require('../Models/verify-codes.schema');
const sendEmail = require('../utilities/mailer.utils');
const { Folder } = require('../Models/folders.schema');
const { File } = require('../Models/files.schema');

const createToken = (email) => {
  return jwt.sign({ email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};


exports.signup = async (req, res, next) => {
  try {
    const {name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.ALL_FIELDS_REQUIRED,
        data: null,
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(HTTP_STATUS_CODE.CONFLICT).json({
        code: HTTP_STATUS_CODE.CONFLICT,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.USER_ALREADY_EXISTS,
        data: null,
      });
    }

    // Encrypt the password
    const encryptedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.ENCRYPTION_KEY
    ).toString();

    const newUser = new User({
      email,
      password: encryptedPassword,
    });

    await newUser.save();

    // Generate JWT token
    const token = createToken(newUser.email);

    return res.status(HTTP_STATUS_CODE.CREATED).json({
      code: HTTP_STATUS_CODE.CREATED,
      status: RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.USER_CREATED_SUCCESSFULLY,
      error: null,
      data: { user: newUser, token },
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.SIGNUP_FAILED,
      data: null,
      error,
    });
    next(error);
  }
};
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!password || !email) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.USER_NOT_FOUND,
        data: null,
      });
    }
    const results = await User.findOne({ email });
    if (!results?.password) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.INVALID_CREDENTIALS,
        data: null,
      });
    }
    var bytes = CryptoJS.AES.decrypt(
      results?.password,
      process.env.ENCRYPTION_KEY
    );
    var dbPassword = bytes.toString(CryptoJS.enc.Utf8);
    if (results && dbPassword !== password)
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.INVALID_CREDENTIALS,
        data: null,
      });

    // Generate JWT token
    const token = createToken(results.email);
    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.USER_LOGGEDIN_SUCCESSFULLY,
      error: null,
      data: { user: results, token },
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.USER_NOT_FOUND,
      data: null,
      error,
    });
    next(error);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        status: HTTP_STATUS_CODE.NOT_FOUND,
        message: MESSAGE.USER_NOT_FOUND,
        success: false,
        data: null,
      });
    }

    const code = generateCode(8);
    await VerificationCode.create({ email, code, is_active: true });

    await sendEmail(email, code);

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: 'Password reset code sent to your email',
      success: true,
      data: true,
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.BAD_REQUEST,
      data: null,
      error,
    });
    next(error);
  }
};

exports.verifyResetCode = async (req, res, next) => {
  try {
    const { email,code } = req.body;

    if (!email) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.ALL_FIELDS_REQUIRED,
        data: null,
      });
    }

    const record = await VerificationCode.findOne({ code, email, is_active: true });
    if (!record) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.CODE_NOT, 
        data: null,
      });
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.CODE_VALID,       // “Code is valid”
      data: true,
    });
  } catch (error) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message,
      data: null,
    });
  }
};


exports.resetPassword = async (req, res, next) => {
  try {
    const { code } = req.params;
    const { email, newPassword } = req.body;

    const record = await VerificationCode.findOne({ code, email });
    if (!record) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        status: HTTP_STATUS_CODE.NOT_FOUND,
        message: 'Invalid or expired reset code',
        success: false,
        data: null,
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        status: HTTP_STATUS_CODE.NOT_FOUND,
        message: MESSAGE.USER_NOT_FOUND,
        success: false,
        data: null,
      });
    }

    const encrypted = CryptoJS.AES.encrypt(
      newPassword,
      process.env.ENCRYPTION_KEY
    ).toString();

    user.password = encrypted;
    await user.save();

    // Optionally delete used code
    await VerificationCode.deleteOne({ code, email });

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: 'Password reset successfully',
      success: true,
      data: true,
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.BAD_REQUEST,
      data: null,
      error,
    });
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { email, currentPassword, newPassword } = req.body;

    if (!email || !currentPassword || !newPassword) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.ALL_FIELDS_REQUIRED,
        data: null,
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.USER_NOT_FOUND,
        data: null,
      });
    }

    // Decrypt the stored password
    const bytes = CryptoJS.AES.decrypt(user.password, process.env.ENCRYPTION_KEY);
    const decryptedPassword = bytes.toString(CryptoJS.enc.Utf8);

    if (decryptedPassword !== currentPassword) {
      return res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({
        code: HTTP_STATUS_CODE.UNAUTHORIZED,
        status: RESPONSE_TITLES.ERROR,
        message: 'Current password is incorrect',
        data: null,
      });
    }

    // Encrypt and update new password
    const encryptedNewPassword = CryptoJS.AES.encrypt(
      newPassword,
      process.env.ENCRYPTION_KEY
    ).toString();

    user.password = encryptedNewPassword;
    await user.save();

    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: 'Password changed successfully',
      data: true,
    });

  } catch (error) {
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.INTERNAL_SERVER_ERROR,
      data: null,
      error,
    });
    next(error);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const results = await User.findOne({ _id: id });
    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.RESPONSE_SUCCESS,
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: MESSAGE.BAD_REQUEST,
      data: null,
      error,
    });
    next(error);
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const results = await User.deleteOne({ _id: id });

    if (results.deletedCount === 0) {
      return res.status(404).json({
        status: 404,
        message: 'User not found',
        success: false,
        data: results,
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'User deleted successfully',
      success: true,
      data: results,
    });
  } catch (error) {
    return res.status(400).json({
      code: 400,
      status: 'ERROR',
      message: 'Invalid request',
      data: null,
      error: error.message,
    });
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    if (updateFields.password) {
      const encPass = CryptoJS.AES.encrypt(
        updateFields.password,
        process.env.ENCRYPTION_KEY
      ).toString();
      updateFields.password = encPass;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        status: HTTP_STATUS_CODE.NOT_FOUND,
        message: MESSAGE.USER_NOT_FOUND,
        success: false,
        data: null,
      });
    }
    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.DATA_UPDATED,
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: MESSAGE.BAD_REQUEST,
      data: null,
      error,
    });
    next(error);
  }
};


exports.markFavourite = async (req, res, next) => {
  try {
    const { resId } = req.body;

    if (!resId) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: 'resId is required',
        data: null,
      });
    }

    let updated = await File.findByIdAndUpdate(
      resId,
      { favourite: true },
      { new: true }
    );

    if (!updated) {
      updated = await Folder.findByIdAndUpdate(
        resId,
        { favourite: true },
        { new: true }
      );
    }

    if (!updated) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: 'Item not found in File or Folder',
        data: null,
      });
    }

    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: 'Marked as favourite successfully',
      data: updated,
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message,
      data: null,
    });
    next(error);
  }
};

exports.getFavourites = async (req, res, next) => {
  try {
    const userId = req.user._id; // Make sure you're using auth middleware to populate this

    const [favouriteFiles, favouriteFolders] = await Promise.all([
      File.find({ user: userId, favourite: true }),
      Folder.find({ user: userId, favourite: true }),
    ]);

    const result = {
      files: favouriteFiles,
      folders: favouriteFolders,
    };

    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: 'Favourite items retrieved successfully',
      data: result,
    });
  } catch (error) {
    res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message,
      data: null,
    });
    next(error);
  }
};

exports.getByDate = async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: 'Query parameter `date` is required (YYYY-MM-DD)',
        data: null,
      });
    }

    const start = new Date(date);
    if (isNaN(start)) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: 'Invalid date format. Use YYYY-MM-DD.',
        data: null,
      });
    }
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const userId = req.user._id; // assume auth middleware

    // Query folders and files created on that date
    const [folders, files] = await Promise.all([
      Folder.find({
        user: userId,
        createdAt: { $gte: start, $lt: end },
      })
        .lean(),
      File.find({
        user: userId,
        createdAt: { $gte: start, $lt: end },
      })
        .lean(),
    ]);

    // Normalize file URLs
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const filesWithUrls = files.map((f) => ({
      ...f,
      url: f.url.startsWith('http')
        ? f.url
        : `${baseUrl}${f.url}`,
    }));

    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.RESPONSE_SUCCESS,
      data: { folders, files: filesWithUrls },
    });
  } catch (err) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: err.message,
      data: null,
    });
  }
};

exports.getRecents = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const [ folders, files ] = await Promise.all([
      Folder.find({ user: userId, parent: null })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
      File.find({ user: userId, folder: null })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
    ]);

    const tagged = [
      ...folders.map(f => ({ ...f, __type: 'folder', date: f.updatedAt || f.createdAt })),
      ...files  .map(f => ({ ...f, __type: 'file',   date: f.updatedAt || f.createdAt })),
    ];

    const combined = tagged
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = combined.map(item => {
      if (item.__type === 'file') {
        return {
          ...item,
          url: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
        };
      }
      return item;
    });

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.RESPONSE_SUCCESS,
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: MESSAGE.BAD_REQUEST,
      data: null,
      error,
    });
  }
};

const  parseFileSize=(sizeStr) =>{
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const [numStr, unit = 'B'] = sizeStr.split(' ');
  const num = parseFloat(numStr) || 0;
  switch (unit.toUpperCase()) {
    case 'B':  return num;
    case 'KB': return num * 1024;
    case 'MB': return num * 1024 * 1024;
    case 'GB': return num * 1024 * 1024 * 1024;
    default:   return num; 
  }
}
const formatBytes = (bytes)=> {
  if (bytes < 1024)              return bytes.toFixed(0) + ' B';
  if (bytes < 1024 * 1024)       return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

exports.getFileSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const files = await File.find({ user: userId }).lean();
 
    const folderCount = await Folder.countDocuments({ user: userId });

    const summary = {
      folders: { count: folderCount, size: 0 },
      notes:   { count: 0, size: 0 },
      images:  { count: 0, size: 0 },
      pdfs:    { count: 0, size: 0 },
    };


    const noteExts  = ['txt','md','doc','docx'];
    const imageExts = ['jpg','jpeg','png','gif','webp'];
    const pdfExts   = ['pdf'];

    let totalBytes = 0;
    for (const f of files) {
      const ext   = f.name.split('.').pop().toLowerCase();
      const bytes = parseFileSize(f.fileSize); 
      totalBytes += bytes;

      if (noteExts.includes(ext)) {
        summary.notes.count++;
        summary.notes.size += bytes;
      } else if (imageExts.includes(ext)) {
        summary.images.count++;
        summary.images.size += bytes;
      } else if (pdfExts.includes(ext)) {
        summary.pdfs.count++;
        summary.pdfs.size += bytes;
      }
    }

    summary.folders.size = totalBytes;

    summary.folders.size = formatBytes(summary.folders.size);
    summary.notes.size   = formatBytes(summary.notes.size);
    summary.images.size  = formatBytes(summary.images.size);
    summary.pdfs.size    = formatBytes(summary.pdfs.size);

    return res.status(HTTP_STATUS_CODE.OK).json({
      code:    HTTP_STATUS_CODE.OK,
      status:  RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.RESPONSE_SUCCESS,
      data:    summary,
    });
  } catch (error) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code:    HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status:  RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.BAD_REQUEST,
      data:    null,
    });
  }
};
