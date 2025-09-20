const { errorResponse } = require("../utils/responseHelper");

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        "Validation error",
        400,
        error.details.map((d) => d.message)
      );
    }
    next();
  };
};

module.exports = validate;
