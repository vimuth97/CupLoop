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
        coordinates: {
          type: "Point",
          coordinates: [lng, lat] // GeoJSON order: [longitude, latitude]
        }
      },
      contactInfo: contactInfo.trim(),
      cupInventoryCount: 0,
      activeStatus: false // pending admin approval
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

  /**
   * Approve a cafe — sets activeStatus to true and records approval timestamp.
   * @param {string} cafeId
   * @returns {Promise<Cafe>}
   */
  async approveCafe(cafeId) {
    const cafe = await Cafe.findByIdAndUpdate(
      cafeId,
      { activeStatus: true, approvedAt: new Date(), rejectedReason: null },
      { new: true }
    );

    if (!cafe) {
      const err = new Error("Cafe not found");
      err.status = 404;
      err.code = "CAFE_NOT_FOUND";
      throw err;
    }

    return cafe;
  }

  /**
   * Reject a cafe registration — records the rejection reason.
   * @param {string} cafeId
   * @param {string} reason
   * @returns {Promise<Cafe>}
   */
  async rejectCafe(cafeId, reason) {
    const cafe = await Cafe.findByIdAndUpdate(
      cafeId,
      { activeStatus: false, rejectedReason: reason, approvedAt: null },
      { new: true }
    );

    if (!cafe) {
      const err = new Error("Cafe not found");
      err.status = 404;
      err.code = "CAFE_NOT_FOUND";
      throw err;
    }

    return cafe;
  }

  /**
   * Get all cafes pending approval (activeStatus=false, not yet approved or rejected)
   * @returns {Promise<Cafe[]>}
   */
  async getPendingCafes() {
    return Cafe.find({
      activeStatus: false,
      approvedAt: null,
      rejectedReason: null
    }).populate("ownerId", "firstName lastName email");
  }

  /**
   * Get all active cafes, optionally filtered by proximity.
   * Uses MongoDB's $near geospatial query with a 2dsphere index —
   * no manual distance calculation needed.
   *
   * @param {Object} [location] - { lat, lng, radius } radius in km
   * @returns {Promise<Cafe[]>}
   */
  async getActiveCafes(location) {
    const filter = { activeStatus: true };

    if (location) {
      const { lat, lng, radius } = location;
      // $near returns results sorted by distance (nearest first)
      // $maxDistance is in metres
      filter["location.coordinates"] = {
        $near: {
          $geometry: { type: "Point", coordinates: [lng, lat] },
          $maxDistance: radius * 1000
        }
      };
    }

    return Cafe.find(filter)
      .select("-rejectedReason -approvedAt")
      .lean();
  }
}

module.exports = new CafeService();
