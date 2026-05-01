const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const CafeService = require("../services/CafeService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

// All admin routes require a valid JWT with role "admin"
router.use(authenticate, requireRole("admin"));

/**
 * GET /api/admin/cafes/pending
 *
 * List all cafe registrations awaiting approval.
 *
 * Responses:
 *   200 - Array of pending cafe records
 */
router.get("/cafes/pending", async (req, res, next) => {
  try {
    const cafes = await CafeService.getPendingCafes();

    return res.status(200).json({
      count: cafes.length,
      cafes
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/cafes/:cafeId/approve
 *
 * Approve a cafe registration. Sets activeStatus to true so the cafe owner
 * can access all cafe management endpoints.
 *
 * Params:
 *   cafeId - MongoDB ObjectId of the cafe
 *
 * Responses:
 *   200 - Cafe approved
 *   404 - Cafe not found
 */
router.put("/cafes/:cafeId/approve", async (req, res, next) => {
  try {
    const { cafeId } = req.params;

    const cafe = await CafeService.approveCafe(cafeId);

    return res.status(200).json({
      message: "Cafe approved successfully",
      cafe: {
        id: cafe._id,
        name: cafe.name,
        location: cafe.location,
        contactInfo: cafe.contactInfo,
        activeStatus: cafe.activeStatus,
        approvedAt: cafe.approvedAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/cafes/:cafeId/reject
 *
 * Reject a cafe registration with a mandatory reason.
 *
 * Params:
 *   cafeId - MongoDB ObjectId of the cafe
 *
 * Body:
 *   { reason: string }
 *
 * Responses:
 *   200 - Cafe rejected
 *   400 - Missing rejection reason
 *   404 - Cafe not found
 */
router.put("/cafes/:cafeId/reject", async (req, res, next) => {
  try {
    const { cafeId } = req.params;
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Invalid input", {
          reason: "A rejection reason is required"
        })
      );
    }

    const cafe = await CafeService.rejectCafe(cafeId, reason.trim());

    return res.status(200).json({
      message: "Cafe registration rejected",
      cafe: {
        id: cafe._id,
        name: cafe.name,
        activeStatus: cafe.activeStatus,
        rejectedReason: cafe.rejectedReason
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
