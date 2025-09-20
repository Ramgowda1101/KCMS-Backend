const { errorResponse } = require("../utils/responseHelper");

module.exports = (err, req, res, next) => {
  console.error(err.stack);
  errorResponse(res, err.message || "Internal Server Error", err.status || 500);
};
