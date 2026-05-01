const Cafe = require("../models/cafe");

class CafeService {
  /**
   * Find a cafe by its owner's user ID
   * @param {string} ownerId
   * @returns {Promise<Cafe|null>}
   */
  async findByOwner(ownerId) {
    return Cafe.findOne({ ownerId });
  }

  /**
   * Create a new cafe record linked to an owner user account.
   * activeStatus is always false — requires admin approval before access is granted.
   * @param {Object} cafeData - { ownerId, name, address, lat, lng, contactInfo }
   * @returns {Promise<Cafe>}
   */
  async createCafe({ ownerId, name, address, lat, lng, contactInfo }) {
    const cafe = await Cafe.create({
      ownerId,
      name: name.trim(),
      location: {
        address: address.trim(),
        lat,
        lng
      },
      contactInfo: contactInfo.trim(),
      cupInventoryCount: 0,
      activeStatus: false  // pending admin approval
    });

    return cafe;
  }

  /**
   * Get a cafe by its ID
   * @param {string} cafeId
   * @returns {Promise<Cafe|null>}
   */
  async findById(cafeId) {
    return Cafe.findById(cafeId);
  }
}

module.exports = new CafeService();
