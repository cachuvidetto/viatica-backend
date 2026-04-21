const express = require('express');
const feedController = require('../controllers/feed.controller');
const authController = require('../middlewares/auth');

const router = express.Router();

router.use(authController.protect);

router.route('/')
  .get(feedController.getAllFeeds)
  .post(authController.restrictTo('admin', 'warehouse'), feedController.createFeed);

router.route('/:id')
  .delete(authController.restrictTo('admin', 'warehouse'), feedController.deleteFeed);

module.exports = router;
