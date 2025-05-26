const express = require('express');
const Router = express.Router();
const fileController = require('../Controllers/file.controller');
const authenticateRequest = require('../Middlewares/auth.middleware');
const corsParse = require('../Middlewares/cors.middleware');

Router.post(
  '/upload',
  authenticateRequest,
  corsParse,
  fileController.uploadFile
);
Router.get('/shared-file/:id/link/:link', corsParse, fileController.getOneBySharedLink);
Router.get('/notes', authenticateRequest, corsParse, fileController.getAllNotes);
Router.get('/images', authenticateRequest, corsParse, fileController.getAllImages);
Router.get('/pdfs', authenticateRequest, corsParse, fileController.getAllPdfs);
Router.get('/search', authenticateRequest, corsParse, fileController.search);
Router.delete('/delete/:id', authenticateRequest, corsParse, fileController.remove);
Router.put(
  '/update/:id',
  authenticateRequest,
  corsParse,
  fileController.updateFile
);
Router.post('/:id/share', authenticateRequest, corsParse, fileController.shareLink);
Router.post('/copy', authenticateRequest, corsParse, fileController.copyFileOrFolder);


module.exports = Router;
