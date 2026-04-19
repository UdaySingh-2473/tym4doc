const crypto = require("crypto");

/**
 * Generates a secure random 32-byte hex string.
 * Used for password resets and email verification links.
 */
exports.generateRandomHexToken = () => {
  return crypto.randomBytes(32).toString("hex");
};
