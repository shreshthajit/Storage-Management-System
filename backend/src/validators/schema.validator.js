const Joi = require('joi');

const UserValidator = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().required(),
  password: Joi.string().required(),
});

const SignUpValidator = Joi.object({
  email: Joi.string().required(),
  password: Joi.string().required(),
});

const FolderValidator = Joi.object({
  name: Joi.string().required(),
  parent: Joi.string().allow(null),
});


module.exports = {
  UserValidator,
  SignUpValidator,
  FolderValidator,
};
