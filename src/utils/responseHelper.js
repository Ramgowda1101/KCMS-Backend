exports.successResponse = (res, message, data = {}, statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

exports.errorResponse = (res, message, statusCode = 500, details = []) => {
  return res.status(statusCode).json({
    success: false,
    message,
    details,
  });
};
