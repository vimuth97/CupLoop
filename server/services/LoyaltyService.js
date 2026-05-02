const User = require("../models/user");
const Reward = require("../models/reward");
const CupTransaction = require("../models/cupTransaction");

class LoyaltyService {
  /**
   * Get the consumer's current loyalty points balance and full earning history.
   * Each history entry includes the source type, points earned, the cafe where
   * it happened, the linked transaction, and the timestamp.
   *
   * @param {string} userId
   * @returns {Promise<{ totalPoints: number, history: Array }>}
   */
  async getLoyaltySummary(userId) {
    const [user, rewards, singleUseCupsAvoided] = await Promise.all([
      User.findById(userId).select("loyaltyPoints").lean(),
      Reward.find({ userId })
        .populate({
          path: "transactionId",
          select: "type status completedAt cafeId cupId",
          populate: [
            { path: "cafeId", select: "name location.address" },
            { path: "cupId",  select: "barcode materialType" }
          ]
        })
        .sort({ createdAt: -1 })
        .lean(),
      // Every completed buy/rent/own_cup = one single-use cup avoided
      CupTransaction.countDocuments({
        userId,
        status: "completed",
        type: { $in: ["buy", "rent", "own_cup"] }
      })
    ]);

    if (!user) {
      const err = new Error("User not found");
      err.status = 404;
      err.code = "USER_NOT_FOUND";
      throw err;
    }

    const history = rewards.map((reward) => {
      const tx = reward.transactionId;
      return {
        rewardId:    reward._id,
        points:      reward.points,
        source:      reward.source,
        earnedAt:    reward.createdAt,
        transaction: tx
          ? {
              id:          tx._id,
              type:        tx.type,
              status:      tx.status,
              completedAt: tx.completedAt
            }
          : null,
        cafe: tx?.cafeId
          ? { id: tx.cafeId._id, name: tx.cafeId.name, address: tx.cafeId.location?.address }
          : null,
        cup: tx?.cupId
          ? { barcode: tx.cupId.barcode, materialType: tx.cupId.materialType }
          : null
      };
    });

    return {
      totalPoints: user.loyaltyPoints,
      impact: {
        singleUseCupsAvoided
      },
      history
    };
  }
}

module.exports = new LoyaltyService();
