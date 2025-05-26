const express = require('express');
const Router = express.Router();
const folderController = require('../Controllers/folder.controller');
const authenticateRequest = require('../Middlewares/auth.middleware');
const corsParse = require('../Middlewares/cors.middleware');

Router.post(
  '/create',
  authenticateRequest,
  corsParse,
  folderController.create
);
Router.delete('/delete/:id', authenticateRequest, corsParse, folderController.remove);
Router.get('/all', authenticateRequest, corsParse, folderController.getAll);
Router.get('/', authenticateRequest, corsParse, folderController.getParentFoldersAndFiles);
Router.get('/:id', authenticateRequest, corsParse, folderController.getOne);
Router.patch('/:id', authenticateRequest, corsParse, folderController.update);
module.exports = Router;
