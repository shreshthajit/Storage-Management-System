const {
  HTTP_STATUS_CODE,
  MESSAGE,
  RESPONSE_TITLES,
} = require('../utilities/constants.utils');
const { FolderValidator } = require('../validators/schema.validator');
const { Folder } = require('../Models/folders.schema');
const { File } = require('../Models/files.schema');

exports.create = async (req, res, next) => {
  try {
    await FolderValidator.validateAsync({ ...req.body });
    const newFolder = await Folder.create({ ...req.body, user: req.user._id });
    if (!newFolder) {
      return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
        code: HTTP_STATUS_CODE.BAD_REQUEST,
        status: RESPONSE_TITLES.ERROR,
        message: MESSAGE.FAILED_TO_CREATE_FOLDER,
        data: null,
      });
    }
    return res.status(HTTP_STATUS_CODE.CREATED).json({
      status: HTTP_STATUS_CODE.CREATED,
      message: MESSAGE.SUCCESSFUL,
      success: true,
      data: newFolder,
    });
  } catch (error) {
    console.log('Error occurred ', error);
    res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: MESSAGE.FAILED_TO_CREATE_FOLDER,
      data: null,
      error,
    });
    next(error);
  }
};

exports.update = async (req, res, next) => {
  const { id } = req.params;
  
  const validatedData = await FolderValidator.validateAsync({ ...req.body });

  const updatedDoc = await Folder.findOneAndUpdate({ _id: id, user: req.user._id }, validatedData, { new: true }).lean();
  if (!updatedDoc) {
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: MESSAGE.FAILED_TO_UPDATE_FOLDER,
      data: null,
    });
  }
  return res.status(HTTP_STATUS_CODE.CREATED).json({
    status: HTTP_STATUS_CODE.CREATED,
    message: MESSAGE.SUCCESSFUL,
    success: true,
    data: updatedDoc,
  });
};



exports.getOne = async (req, res, next) => {
  const { id } = req.params;
  const result = await Folder.findById(id).populate({
    path: 'parent',
    select: 'name _id',
  }).lean();
  if (!result) {
    return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
      code: HTTP_STATUS_CODE.NOT_FOUND,
      status: RESPONSE_TITLES.NOT_FOUND,
      message: MESSAGE.FOLDER_NOT_FOUND,
      data: null,
    });
  }
  const files = await File.find({ folder: result._id }).lean();
  const filesWithPresignedUrls = await Promise.all(
    (files || [])?.map(async (file) => {
      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: file.url,
        Expires: 3600, // Expiry time for the URL in seconds (e.g., 1 hour)
      };
      const preSignedUrl = await s3.getSignedUrlPromise('getObject', params);
      return { ...file, url: preSignedUrl };
    })
  );
  const folders = await Folder.find({ parent: result._id }).lean();
  return res.status(HTTP_STATUS_CODE.OK).json({
    status: HTTP_STATUS_CODE.OK,
    message: MESSAGE.RESPONSE_SUCCESS,
    success: true,
    data: { ...result, files: filesWithPresignedUrls, folders },
  });
};

exports.getAll = async (req, res, next) => {
  const folders = await Folder.find({ user: req.user._id }).lean();
  return res.status(HTTP_STATUS_CODE.OK).json({
    status: HTTP_STATUS_CODE.OK,
    message: MESSAGE.RESPONSE_SUCCESS,
    success: true,
    data: folders,
  });
};

exports.getParentFoldersAndFiles = async (req, res, next) => {
  try {
    const folders = await Folder.find({ user: req.user._id, parent: null }).lean();
    const files = await File.find({ user: req.user._id, folder: null }).lean();

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
      data: { folders, files: filesWithLocalUrls },
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


exports.remove = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await Folder.findOneAndDelete({ _id: id, user: req.user._id }).lean();

    if (!result) {
      return res.status(HTTP_STATUS_CODE.NOT_FOUND).json({
        code: HTTP_STATUS_CODE.NOT_FOUND,
        status: RESPONSE_TITLES.NOT_FOUND,
        message: MESSAGE.FOLDER_NOT_FOUND || 'Folder not found',
        data: null,
      });
    }

    // TODO: Optionally delete nested folders/files if needed here

    return res.status(HTTP_STATUS_CODE.OK).json({
      status: HTTP_STATUS_CODE.OK,
      message: MESSAGE.DELETE_SUCCESS || 'Folder deleted successfully',
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return res.status(HTTP_STATUS_CODE.BAD_REQUEST).json({
      code: HTTP_STATUS_CODE.BAD_REQUEST,
      status: RESPONSE_TITLES.ERROR,
      message: error.message || 'Failed to delete folder',
      success: false,
      data: null,
    });
  }
};
