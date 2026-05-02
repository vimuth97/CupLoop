const Cup = require("../models/cup");

class CupService {
  /**
   * Bulk-insert multiple cups into the system.
   * Uses ordered:false so a duplicate barcode does not abort the entire batch.
   * @param {string} cafeId - The cafe all cups are assigned to
   * @param {Array<{ barcode: string, materialType?: string }>} cups
   * @returns {Promise<{ inserted: Cup[], duplicates: string[], total: number }>}
   */
  async bulkCreate(cafeId, cups) {
    const docs = cups.map(({ barcode, materialType }) => ({
      barcode: barcode.trim(),
      materialType: materialType?.trim() || undefined,
      currentCafeId: cafeId,
      status: "available"
    }));

    let insertedDocs = [];
    const duplicateBarcodes = [];

    try {
      const result = await Cup.insertMany(docs, { ordered: false });
      insertedDocs = result;
    } catch (err) {
      if (err.writeErrors) {
        insertedDocs = err.insertedDocs || [];
        for (const writeErr of err.writeErrors) {
          if (writeErr.code === 11000) {
            const barcode =
              writeErr.err?.op?.barcode ||
              writeErr.errmsg?.match(/barcode: "([^"]+)"/)?.[1];
            if (barcode) duplicateBarcodes.push(barcode);
          } else {
            throw writeErr;
          }
        }
      } else {
        throw err;
      }
    }

    return { inserted: insertedDocs, duplicates: duplicateBarcodes, total: insertedDocs.length };
  }

  /**
   * Get cup counts grouped by status using a single aggregation pipeline.
   * @returns {Promise<{ available: number, in_use: number, damaged: number, lost: number, total: number }>}
   */
  async getStatusSummary() {
    const results = await Cup.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const summary = { available: 0, in_use: 0, damaged: 0, lost: 0 };
    for (const { _id, count } of results) {
      if (_id in summary) summary[_id] = count;
    }
    summary.total = Object.values(summary).reduce((a, b) => a + b, 0);
    return summary;
  }

  /**
   * Get all cups currently assigned to a specific cafe, grouped by status.
   * @param {string} cafeId
   * @returns {Promise<{ cups: Cup[], summary: Object }>}
   */
  async getCafeInventory(cafeId) {
    const cups = await Cup.find({ currentCafeId: cafeId })
      .select("barcode status materialType lastUsedAt createdAt")
      .sort({ status: 1, createdAt: -1 })
      .lean();

    // Build a status summary from the returned cups
    const summary = { available: 0, in_use: 0, damaged: 0, lost: 0, total: cups.length };
    for (const cup of cups) {
      if (cup.status in summary) summary[cup.status]++;
    }

    return { cups, summary };
  }

  /**
   * Find a cup by its barcode
   * @param {string} barcode
   * @returns {Promise<Cup|null>}
   */
  async findByBarcode(barcode) {
    return Cup.findOne({ barcode });
  }

  /**
   * Find a cup by its ID
   * @param {string} cupId
   * @returns {Promise<Cup|null>}
   */
  async findById(cupId) {
    return Cup.findById(cupId);
  }

  /**
   * Get all cups with status "damaged" or "lost", optionally filtered by one status.
   * @param {string} [status] - "damaged" | "lost" | undefined (returns both)
   * @returns {Promise<Cup[]>}
   */
  async getRetiredCups(status) {
    const validStatuses = ["damaged", "lost"];
    const filter = {
      status: status && validStatuses.includes(status) ? status : { $in: validStatuses }
    };
    return Cup.find(filter)
      .populate("currentCafeId", "name")
      .populate("currentUserId", "firstName lastName email")
      .lean();
  }

  /**
   * Permanently delete a single cup by ID.
   * Only cups with status "damaged" or "lost" can be removed.
   * @param {string} cupId
   * @returns {Promise<Cup>} The deleted cup document
   */
  async deleteCup(cupId) {
    const cup = await Cup.findById(cupId);

    if (!cup) {
      const err = new Error("Cup not found");
      err.status = 404;
      err.code = "CUP_NOT_FOUND";
      throw err;
    }

    if (!["damaged", "lost"].includes(cup.status)) {
      const err = new Error(
        `Only damaged or lost cups can be removed. This cup is "${cup.status}"`
      );
      err.status = 409;
      err.code = "INVALID_CUP_STATUS";
      throw err;
    }

    await Cup.deleteOne({ _id: cupId });
    return cup;
  }

  /**
   * Permanently delete all cups with status "damaged" or "lost".
   * @param {string} [status] - "damaged" | "lost" | undefined (deletes both)
   * @returns {Promise<{ deleted: number }>}
   */
  async bulkDeleteRetired(status) {
    const validStatuses = ["damaged", "lost"];
    const filter = {
      status: status && validStatuses.includes(status) ? status : { $in: validStatuses }
    };
    const result = await Cup.deleteMany(filter);
    return { deleted: result.deletedCount };
  }
}

module.exports = new CupService();
