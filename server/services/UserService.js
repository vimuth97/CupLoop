const bcrypt = require("bcrypt");
const User = require("../models/user");

const BCRYPT_COST = 12;

class UserService {
  /**
   * Find a user by email (case-insensitive)
   * @param {string} email
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  }

  /**
   * Create a new consumer user
   * @param {Object} userData - { firstName, lastName, email, password }
   * @returns {Promise<User>}
   */
  async createConsumer({ firstName, lastName, email, password }) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase(),
      passwordHash,
      role: "consumer",
      loyaltyPoints: 0,
      accountStatus: "active"
    });

    return user;
  }

  /**
   * Get user by ID
   * @param {string} userId
   * @returns {Promise<User|null>}
   */
  async findById(userId) {
    return User.findById(userId);
  }
}

module.exports = new UserService();
