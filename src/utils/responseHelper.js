// src/utils/responseHelper.js
function successResponse(res, message = "Success", data = {}, status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

function errorResponse(res, message = "Error", status = 400, errors = null) {
  const payload = {
    success: false,
    message,
  };
  if (errors) payload.errors = errors;
  return res.status(status).json(payload);
}

module.exports = { successResponse, errorResponse };
