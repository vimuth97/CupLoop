const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const CafeService = require("../services/CafeService");
const CupService = require("../services/CupService");
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

/**
 * POST /api/admin/cups/bulk
 *
 * Add multiple cups to the system in a single request.
 * Duplicate barcodes are skipped and reported — they do not abort the batch.
 *
 * Body:
 *   {
 *     cups: [
 *       { barcode: string, materialType?: string, cafeId?: string },
 *       ...
 *     ]
 *   }
 *
 * Responses:
 *   201 - All cups inserted successfully
 *   207 - Partial success (some duplicates skipped)
 *   400 - Validation error (empty array, missing barcodes, etc.)
 */
router.post("/cups/bulk", async (req, res, next) => {
  try {
    const { cups } = req.body;

    // --- Validation ---
    if (!Array.isArray(cups) || cups.length === 0) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "cups must be a non-empty array")
      );
    }

    if (cups.length > 500) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Maximum 500 cups can be added in a single request")
      );
    }

    // Validate each cup entry
    const itemErrors = [];
    cups.forEach((cup, index) => {
      if (!cup.barcode || typeof cup.barcode !== "string" || cup.barcode.trim().length === 0) {
        itemErrors.push(`cups[${index}]: barcode is required`);
      }
    });

    if (itemErrors.length > 0) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "One or more cup entries are invalid", { items: itemErrors })
      );
    }

    // --- Bulk insert ---
    const { inserted, duplicates, total } = await CupService.bulkCreate(cups);

    const hasDuplicates = duplicates.length > 0;
    const status = hasDuplicates ? 207 : 201;

    return res.status(status).json({
      message: hasDuplicates
        ? `${total} cup(s) added. ${duplicates.length} duplicate barcode(s) were skipped.`
        : `${total} cup(s) added successfully.`,
      inserted: total,
      skippedDuplicates: duplicates.length,
      duplicateBarcodes: duplicates
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/cups/retired
 *
 * List all cups with status "damaged" or "lost".
 * Optionally filter by a specific status using the ?status query param.
 *
 * Query params:
 *   status - "damaged" | "lost" (optional, returns both if omitted)
 *
 * Responses:
 *   200 - List of retired cups
 *   400 - Invalid status value
 */
router.get("/cups/retired", async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !["damaged", "lost"].includes(status)) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Invalid input", {
          status: 'status must be "damaged" or "lost"'
        })
      );
    }

    const cups = await CupService.getRetiredCups(status);

    return res.status(200).json({
      count: cups.length,
      filter: status || "damaged,lost",
      cups
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/cups/:cupId
 *
 * Permanently remove a single damaged or lost cup from the system.
 * Returns 409 if the cup is in any other status (available, in_use).
 *
 * Params:
 *   cupId - MongoDB ObjectId of the cup
 *
 * Responses:
 *   200 - Cup removed
 *   404 - Cup not found
 *   409 - Cup is not in a removable state
 */
router.delete("/cups/:cupId", async (req, res, next) => {
  try {
    const { cupId } = req.params;

    const cup = await CupService.deleteCup(cupId);

    return res.status(200).json({
      message: `Cup "${cup.barcode}" has been permanently removed from the system`,
      removed: {
        id: cup._id,
        barcode: cup.barcode,
        status: cup.status,
        materialType: cup.materialType
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/cups/retired/bulk
 *
 * Permanently remove all damaged and/or lost cups in one operation.
 * Optionally scope to a single status with ?status=damaged or ?status=lost.
 *
 * Query params:
 *   status - "damaged" | "lost" (optional, deletes both if omitted)
 *
 * Responses:
 *   200 - Cups removed, returns count
 *   400 - Invalid status value
 */
router.delete("/cups/retired/bulk", async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !["damaged", "lost"].includes(status)) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Invalid input", {
          status: 'status must be "damaged" or "lost"'
        })
      );
    }

    const { deleted } = await CupService.bulkDeleteRetired(status);

    return res.status(200).json({
      message: `${deleted} cup(s) permanently removed from the system`,
      deleted,
      filter: status || "damaged,lost"
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
