const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const requireActiveStatus = require("../middleware/requireActiveStatus");
const CupService = require("../services/CupService");

const router = express.Router();

// All cafe routes require a valid JWT with role "cafe" and an approved cafe account
router.use(authenticate, requireRole("cafe"), requireActiveStatus);

/**
 * GET /api/cafe/inventory
 *
 * Returns all cups currently assigned to the authenticated cafe,
 * along with a status breakdown summary.
 *
 * The cafe is identified from the JWT — no cafeId param needed.
 *
 * Responses:
 *   200 - Full cup inventory with summary
 *   403 - Cafe not yet approved
 */
router.get("/inventory", async (req, res, next) => {
  try {
    // req.cafe is attached by requireActiveStatus middleware
    const { cups, summary } = await CupService.getCafeInventory(req.cafe._id);

    return res.status(200).json({
      cafe: {
        id: req.cafe._id,
        name: req.cafe.name
      },
      summary,
      cups
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
