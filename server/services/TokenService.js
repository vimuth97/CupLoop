const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/refreshToken");

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

class TokenService {
  /**
   * Issue a signed JWT access token.
   * @param {Object} payload - { id, role }
   * @returns {string} Signed JWT
   */
  issueAccessToken({ id, role }) {
    return jwt.sign(
      { sub: id.toString(), role },
      process.env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  /**
   * Create and persist a refresh token for the given user.
   * @param {Object} param - { userId, role }
   * @returns {Promise<string>} The opaque refresh token string
   */
  async issueRefreshToken({ userId, role }) {
    const token = crypto.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

    await RefreshToken.create({ token, userId, role, expiresAt });

    return token;
  }

  /**
   * Validate a refresh token against the store.
   * Returns the stored record if valid, throws if not found or expired.
   * @param {string} token
   * @returns {Promise<RefreshToken>}
   */
  async verifyRefreshToken(token) {
    const record = await RefreshToken.findOne({ token });

    if (!record) {
      const err = new Error("Invalid or expired refresh token");
      err.status = 401;
      err.code = "INVALID_REFRESH_TOKEN";
      throw err;
    }

    if (record.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ _id: record._id });
      const err = new Error("Refresh token has expired");
      err.status = 401;
      err.code = "REFRESH_TOKEN_EXPIRED";
      throw err;
    }

    return record;
  }

  /**
   * Delete a refresh token from the store (logout).
   * @param {string} token
   */
  async revokeRefreshToken(token) {
    await RefreshToken.deleteOne({ token });
  }

  /**
   * Delete all refresh tokens for a user (e.g. on account deactivation).
   * @param {string} userId
   */
  async revokeAllForUser(userId) {
    await RefreshToken.deleteMany({ userId });
  }
}

module.exports = new TokenService();
