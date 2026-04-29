/**
 * Build a consistent error response envelope.
 * @param {string} code   - Machine-readable error code (e.g. "VALIDATION_ERROR")
 * @param {string} message - Human-readable description
 * @param {Object} [fields] - Optional field-level validation details
 */
const errorResponse = (code, message, fields) => {
  const payload = { error: { code, message } };
  if (fields) payload.error.fields = fields;
  return payload;
};

module.exports = errorResponse;
