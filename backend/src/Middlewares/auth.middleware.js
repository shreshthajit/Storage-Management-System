const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const { User } = require('../Models/users.schema');
const { HTTP_STATUS_CODE, RESPONSE_TITLES, MESSAGE } = require('../utilities/constants.utils');

const authenticateRequest = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token)
        return next(res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({ code: HTTP_STATUS_CODE.UNAUTHORIZED, status: RESPONSE_TITLES.UNAUTHORIZED, message: MESSAGE.NOT_LOGGED_IN, data: null }));
    try {
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
        const user = await User.findOne({ email: decoded.email });
       
        if (!user)
            return next(res.status(HTTP_STATUS_CODE.UNAUTHORIZED).json({ code: HTTP_STATUS_CODE.UNAUTHORIZED, status: RESPONSE_TITLES.UNAUTHORIZED, message: MESSAGE.NOT_AUTHORIZED, data: null }));

        if (user) req.user = user;
        else req.user = org;
        next();

    } catch (error) {
        if (error.name === RESPONSE_TITLES.TOKEN_EXPIRED) {
            return next(res.status(HTTP_STATUS_CODE.FORBIDDEN).json({ code: HTTP_STATUS_CODE.FORBIDDEN, status: RESPONSE_TITLES.EXPIRED, message: MESSAGE.JWT_EXPIRED, data: null }));
        }
        next(error);
    }
};

module.exports = authenticateRequest;
