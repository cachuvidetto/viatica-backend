const FeedItem = require('../models/FeedItem');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllFeeds = catchAsync(async (req, res, next) => {
  const feeds = await FeedItem.find({ isActive: true })
    .sort('-createdAt')
    .populate('createdBy', 'name pharmacyName');

  res.status(200).json({
    status: 'success',
    results: feeds.length,
    data: { feeds }
  });
});

exports.createFeed = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'warehouse') {
    return next(new AppError('غير مصرح لك بنشر الأخبار', 403));
  }

  const newFeed = await FeedItem.create({
    ...req.body,
    createdBy: req.user._id
  });

  res.status(201).json({
    status: 'success',
    data: { feed: newFeed }
  });
});

exports.deleteFeed = catchAsync(async (req, res, next) => {
  const feed = await FeedItem.findById(req.params.id);
  
  if (!feed) return next(new AppError('الخبر غير موجود', 404));

  if (req.user.role !== 'admin' && String(feed.createdBy) !== String(req.user._id)) {
      return next(new AppError('لا تملك صلاحية حذف هذا الخبر', 403));
  }

  await FeedItem.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});
