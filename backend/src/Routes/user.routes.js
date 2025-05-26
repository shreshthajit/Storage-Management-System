const express = require('express');
const Router = express.Router();
const userController = require('../Controllers/user.controller');
const authenticateRequest = require('../Middlewares/auth.middleware');
const corsParse = require('../Middlewares/cors.middleware');
const passport = require('passport');

Router.post('/signup-user', corsParse, userController.signup);
Router.post('/login-user', corsParse, userController.login);
Router.post('/forget-pass',corsParse,userController.forgotPassword);
Router.post('/verify-code',corsParse,userController.verifyResetCode);
Router.post('/reset-pass/:code',corsParse,userController.resetPassword);
Router.get('/favourites', authenticateRequest, corsParse, userController.getFavourites);
Router.get(
  '/calendar',
  authenticateRequest,
  corsParse,
  userController.getByDate
);
Router.get(
  '/recents',
   authenticateRequest,
   corsParse, 
   userController.getRecents);

Router.get('/summary', authenticateRequest, corsParse, userController.getFileSummary);
Router.delete('/delete/:id', authenticateRequest, corsParse, userController.remove);
Router.get('/:id', authenticateRequest, corsParse, userController.getOne);
Router.patch('/:id', authenticateRequest, corsParse, userController.update);
Router.post('/change-pass', authenticateRequest, corsParse, userController.changePassword);
Router.post('/favourite/mark', authenticateRequest, corsParse, userController.markFavourite);


module.exports = Router;
