const authController = require('../controllers/auth.controller');

exports.protect = authController.protect;
exports.restrictTo = authController.restrictTo;
exports.optionalProtect = authController.optionalProtect;