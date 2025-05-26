const multer = require('multer');
const mongoose = require('mongoose');
const { File } = require('../Models/files.schema');
const { HTTP_STATUS_CODE, MESSAGE, RESPONSE_TITLES } = require('../utilities/constants.utils');
const path = require('path');
const fs = require('fs');
const { Folder } = require('../Models/folders.schema');
// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..','..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, '-');
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage }).single('file');

const  formatFileSize = (bytes)=> {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

exports.uploadFile = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
          code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
          status: RESPONSE_TITLES.ERROR,
          message: MESSAGE.BAD_REQUEST,
          data: null,
          error: err.message,
        });
      }

      if (!req.file) {
        return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
          code: HTTP_STATUS_CODE.BAD_REQUEST,
          status: RESPONSE_TITLES.ERROR,
          message: 'No file provided',
          data: null,
        });
      }

      const folder = req.body.folder || null;
      const { originalname, mimetype, size, filename } = req.file;
      const fileExtension = originalname.split('.').pop().toLowerCase();

      // Check duplicate
      const existing = await File.findOne({
        name: originalname,
        user: req.user._id,
        folder,
        fileSize: formatFileSize(size),
        fileExtension,
      });
      if (existing) {
        // remove the just-uploaded duplicate file from disk
        fs.unlinkSync(path.join(uploadDir, filename));
        return res.status(HTTP_STATUS_CODE.CONFLICT).json({
          code: HTTP_STATUS_CODE.CONFLICT,
          status: RESPONSE_TITLES.ERROR,
          message: 'File already exists',
          data: existing,
        });
      }

      // Build public URL
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fullUrl = `${baseUrl}/uploads/${filename}`;

      // Save record
      const newFile = new File({
        name: originalname,
        user: req.user._id,
        url: fullUrl,
        fileType: mimetype,
        fileSize: formatFileSize(size),
        fileExtension,
        folder,
      });
      await newFile.save();

      return res.status(HTTP_STATUS_CODE.CREATED).json({
        code: HTTP_STATUS_CODE.CREATED,
        status: RESPONSE_TITLES.SUCCESS,
        message: 'File uploaded successfully',
        data: newFile,
      });
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || MESSAGE.BAD_REQUEST,
      data: null,
    });
  }
};


exports.copyFileOrFolder = async (req, res) => {
  try {
    const { resId, targetFolderId } = req.body;

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const timestamp = Date.now();

    // Try to find as File first
    let resource = await File.findById(resId);

    if (resource) {
      // Handle file copy
      const duplicate = await File.findOne({
        name: resource.name,
        user: req.user._id,
        folder: targetFolderId,
        fileSize: resource.fileSize,
        fileExtension: resource.fileExtension,
      });

      if (duplicate) {
        return res.status(409).json({
          message: 'File already exists in the target folder',
          data: duplicate,
        });
      }

      const sanitizedName = `${timestamp}-${resource.name.replace(/\s+/g, '-')}`;
      const fileUrl = `${baseUrl}/uploads/${sanitizedName}`;

      const newFile = new File({
        name: resource.name,
        user: req.user._id,
        url: fileUrl,
        fileType: resource.fileType,
        fileSize: resource.fileSize,
        fileExtension: resource.fileExtension,
        folder: targetFolderId,
      });

      await newFile.save();

      return res.status(201).json({
        message: 'File copied successfully',
        data: newFile,
      });
    }

    // Try to find as Folder
    resource = await Folder.findById(resId);
    if (resource) {
      // Create a new folder under the target folder
      const newFolder = new Folder({
        name: `${resource.name} Copy`,
        user: req.user._id,
        parent: targetFolderId || null,
      });
      await newFolder.save();

      // Copy all files from original folder to the new folder
      const filesInFolder = await File.find({ folder: resId });

      const copiedFiles = [];

      for (const file of filesInFolder) {
        const sanitizedName = `${timestamp}-${file.name.replace(/\s+/g, '-')}`;
        const fileUrl = `${baseUrl}/uploads/${sanitizedName}`;

        const newFile = new File({
          name: file.name,
          user: req.user._id,
          url: fileUrl,
          fileType: file.fileType,
          fileSize: file.fileSize,
          fileExtension: file.fileExtension,
          folder: newFolder._id,
        });

        await newFile.save();
        copiedFiles.push(newFile);
      }

      return res.status(201).json({
        message: 'Folder and its files copied successfully',
        data: {
          folder: newFolder,
          files: copiedFiles,
        },
      });
    }

    return res.status(404).json({
      message: 'Resource not found',
    });
  } catch (error) {
    console.error('Error copying file or folder:', error);
    return res.status(500).json({
      message: 'Failed to copy file or folder',
      error: error.message,
    });
  }
};

exports.updateFile = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { newName } = req.body;
   
    const fileDoc = await File.findOne({ _id: id, user: req.user._id });
    if (!fileDoc) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.FILE_NOT_FOUND,
        data: null,
      });
    }

    const urlPath = fileDoc.url.replace(/^https?:\/\/[^/]+/, '');
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    const oldFilename = path.basename(urlPath);
    const oldFilePath = path.join(uploadsDir, oldFilename);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: 'File not found on disk',
        data: null,
      });
    }

    const ext = path.extname(oldFilename);        
    const safeBase = newName.trim().replace(/\s+/g,'-');
    const timestamp = Date.now();
    const newFilename = `${timestamp}-${safeBase}${ext}`;
    const newFilePath = path.join(uploadsDir, newFilename);

    fs.renameSync(oldFilePath, newFilePath);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const newUrl = `${baseUrl}/uploads/${newFilename}`;

    fileDoc.name = newName;
    fileDoc.url  = newUrl;
    fileDoc.fileExtension = ext.slice(1).toLowerCase();
    await fileDoc.save();

    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.FILE_UPDATED_SUCCESSFULLY,
      data: fileDoc.toObject(),
    });
  } catch (err) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: err.message || MESSAGE.BAD_REQUEST,
      data: null,
    });
  }
};


exports.search = async (req, res, next) => {
  try {
    const { name } = req.query;

    if (!(name ?? '' !== '')) {
      throw new Error('Provide a valid file name');
    }

    const query = {};
    if (name !== undefined && name !== '') {
      query.name = new RegExp(name, 'i');
    }

    const files = await File.find({ ...query, user: req.user._id })
      .sort({ createdAt: -1 })
      .populate({ path: 'folder', select: 'name' })
      .populate({ path: 'user', select: 'fullname email' })
      .lean();

    const filesWithLocalUrls = files.map((file) => {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return {
        ...file,
        url: `${baseUrl}${file.url}`,
      };
    });

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.RESPONSE_SUCCESS,
      success: true,
      data: filesWithLocalUrls,
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

const getFilesByExtension = async (req, res, next, allowedExtensions) => {
  try {
    const { name } = req.query;
    const query = {
      user: req.user._id,
    };

    if (name) {
      query.name = new RegExp(name, 'i');
    }

    const files = await File.find(query)
      .sort({ createdAt: -1 })
      .populate({ path: 'folder', select: 'name' })
      .populate({ path: 'user', select: 'fullname email' })
      .lean();

    const filteredFiles = files.filter(file => {
      const ext = file.name?.split('.').pop()?.toLowerCase();
      return allowedExtensions.includes(ext);
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const filesWithUrls = filteredFiles.map(file => ({
      ...file,
      url: `${baseUrl}${file.url}`,
    }));

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.RESPONSE_SUCCESS,
      success: true,
      data: filesWithUrls,
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

exports.getAllNotes = (req, res, next) =>
  getFilesByExtension(req, res, next, ['txt','doc', 'docx']);

exports.getAllImages = (req, res, next) =>
  getFilesByExtension(req, res, next, ['jpg', 'jpeg', 'png', 'gif', 'webp']);

exports.getAllPdfs = (req, res, next) =>
  getFilesByExtension(req, res, next, ['pdf']);


exports.getOne = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await File.findById(id)
      .populate({
        path: 'folder',
        select: 'name',
      })
      .populate({
        path: 'user',
        select: 'fullname email',
      })
      .lean();;
    if (!result) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.NOT_FOUND,
        message: MESSAGE.FILE_NOT_FOUND,
        data: null,
      });
    }
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: result.url,
      Expires: 3600, // Expiry time for the URL in seconds (e.g., 1 hour)
    };
    const preSignedUrl = await s3.getSignedUrlPromise('getObject', params);
    result.url = preSignedUrl;
    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.RESPONSE_SUCCESS,
      success: true,
      data: result,
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

exports.getOneBySharedLink = async (req, res, next) => {
  try {
    const { id, link } = req.params;
    // 1) Find the file with that share‑token
    const fileDoc = await File.findOne({
      _id: id,
      'sharedLinks.link': link
    })
    .select('name url')
    .lean();

    if (!fileDoc) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.FILE_NOT_FOUND,
        data: null,
      });
    }

    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    const filename   = path.basename(fileDoc.url);
    const filePath   = path.join(uploadsDir, filename);

    // 3) Does it exist?
    if (!fs.existsSync(filePath)) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: 'File not found on server',
        data: null,
      });
    }
    res.download(
      filePath,
      fileDoc.name,   
      (err) => {
        if (err) {
          next(err);
        }
      }
    );

  } catch (error) {
    return res.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).json({
      code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
      status: RESPONSE_TITLES.ERROR,
      message: error.message,
      data: null,
    });
  }
};

exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const file = await File.findOneAndDelete({ _id: id, user: req.user._id }).lean();

    if (!file) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.NOT_FOUND,
        message: MESSAGE.FILE_NOT_FOUND || 'File not found',
        data: null,
      });
    }
    const filePath = path.join(__dirname, '..', '..', 'uploads', path.basename(file.url));
    fs.unlink(filePath, (err) => {
      if (err) {
        console.warn('File not found on disk or already deleted:', filePath);
      }
    });

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.DELETE_SUCCESS || 'File deleted successfully',
      success: true,
      data: file,
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || 'Failed to delete file',
      success: false,
      data: null,
    });
  }
};



exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    // 1) Validate incoming data
    const { newName } = await FileValidator.validateAsync(req.body);
    // 2) Find existing file record
    const fileDoc = await File.findOne({ _id: id, user: req.user._id });
    if (!fileDoc) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.FILE_NOT_FOUND,
        data: null,
      });
    }

    // 3) Derive old disk path
    //    fileDoc.url is like "http://host/uploads/1634234-oldname.pdf"
    //    or "/uploads/1634234-oldname.pdf"
    const urlPath = fileDoc.url.replace(/^https?:\/\/[^/]+/, '');
    const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
    const oldFilename = path.basename(urlPath);
    const oldFilePath = path.join(uploadsDir, oldFilename);

    if (!fs.existsSync(oldFilePath)) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.ERROR,
        message: 'File not found on disk',
        data: null,
      });
    }

    // 4) Build the new filename (preserve extension)
    const ext = path.extname(oldFilename);              // ".pdf"
    const safeBase = newName.trim().replace(/\s+/g,'-');
    const timestamp = Date.now();
    const newFilename = `${timestamp}-${safeBase}${ext}`;
    const newFilePath = path.join(uploadsDir, newFilename);

    // 5) Rename on disk
    fs.renameSync(oldFilePath, newFilePath);

    // 6) Build new public URL
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const newUrl = `${baseUrl}/uploads/${newFilename}`;

    // 7) Update the DB document
    fileDoc.name = newName;
    fileDoc.url  = newUrl;
    fileDoc.fileExtension = ext.slice(1).toLowerCase();
    await fileDoc.save();

    // 8) Return updated doc
    return res.status(HTTP_STATUS_CODE.OK).json({
      code: HTTP_STATUS_CODE.OK,
      status: RESPONSE_TITLES.SUCCESS,
      message: MESSAGE.FILE_UPDATED_SUCCESSFULLY,
      data: fileDoc.toObject(),
    });
  } catch (err) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: err.message || MESSAGE.BAD_REQUEST,
      data: null,
    });
  }
};


exports.shareLink = async (req, res, next) => {
  const { id } = req.params;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let shareLink = '';
  for (let i = 0; i < 32; i++) {
    shareLink += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  const updatedDoc = await File.findOneAndUpdate({ _id: new mongoose.Types.ObjectId(id), user: req.user._id }, { $push: { sharedLinks: { link: shareLink } } }, { new: true });
  if (!updatedDoc) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: MESSAGE.FAILED_TO_SHARE_FILE,
      data: null,
    });
  }
  return res.status(HTTP_STATUS_CODE.OK).json({
    status: HTTP_STATUS_CODE.OK,
    message: MESSAGE.SUCCESSFUL,
    success: true,
    data: {
      link: `http://localhost:8888/files/shared-file/${id}/link/${shareLink}`
    },
  });
};
