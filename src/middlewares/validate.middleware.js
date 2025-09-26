const { errorResponse } = require("../utils/responseHelper");

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      // map Joi details to messages array and return consistent errorResponse
      const errors = error.details ? error.details.map((d) => d.message) : [];
      return errorResponse(res, "Validation error", 400, errors);
    }
    next();
  };
};

module.exports = validate;