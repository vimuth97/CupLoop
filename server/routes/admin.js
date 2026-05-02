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
 * GET /api/admin/dashboard
 *
 * Returns a platform-wide summary for the admin dashboard:
 *   - Cup counts by status (available, in_use, damaged, lost, total)
 *   - Cafe registration counts (pending, approved, rejected)
 *   - Active cafes with fewer than 100 cups (low inventory alert)
 *
 * Responses:
 *   200 - Dashboard data
 */
router.get("/dashboard", async (req, res, next) => {
  try {
    // Run all three aggregations in parallel
    const [cupSummary, cafeSummary, lowInventoryCafes] = await Promise.all([
      CupService.getStatusSummary(),
      CafeService.getRegistrationSummary(),
      CafeService.getCafesLowOnCups(100)
    ]);

    return res.status(200).json({
      cups: cupSummary,
      cafes: cafeSummary,
      alerts: {
        lowInventoryCafes: {
          threshold: 100,
          count: lowInventoryCafes.length,
          cafes: lowInventoryCafes
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

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
 * Add multiple cups to a specific cafe in a single request.
 * The admin provides a cafeId and a flat list of barcodes.
 * Duplicate barcodes are skipped and reported — they do not abort the batch.
 *
 * Body:
 *   {
 *     cafeId: string,           - MongoDB ObjectId of the destination cafe
 *     barcodes: string[],       - Array of barcode strings (max 500)
 *     materialType?: string     - Optional material type applied to all cups in this batch
 *   }
 *
 * Responses:
 *   201 - All cups inserted successfully
 *   207 - Partial success (some duplicates skipped)
 *   400 - Validation error
 *   404 - Cafe not found
 */
router.post("/cups/bulk", async (req, res, next) => {
  try {
    const { cafeId, barcodes, materialType } = req.body;

    // --- Validation ---
    if (!cafeId || typeof cafeId !== "string" || cafeId.trim().length === 0) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Invalid input", { cafeId: "cafeId is required" })
      );
    }

    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Invalid input", { barcodes: "barcodes must be a non-empty array of strings" })
      );
    }

    if (barcodes.length > 500) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "Maximum 500 cups can be added in a single request")
      );
    }

    const itemErrors = [];
    barcodes.forEach((barcode, index) => {
      if (!barcode || typeof barcode !== "string" || barcode.trim().length === 0) {
        itemErrors.push(`barcodes[${index}]: must be a non-empty string`);
      }
    });

    if (itemErrors.length > 0) {
      return res.status(400).json(
        errorResponse("VALIDATION_ERROR", "One or more barcodes are invalid", { items: itemErrors })
      );
    }

    // --- Verify cafe exists ---
    const cafe = await CafeService.findById(cafeId);
    if (!cafe) {
      return res.status(404).json(
        errorResponse("CAFE_NOT_FOUND", "No cafe found with the provided cafeId")
      );
    }

    // --- Build cup objects and bulk insert ---
    const cups = barcodes.map((barcode) => ({
      barcode,
      materialType: materialType || undefined
    }));

    const { inserted, duplicates, total } = await CupService.bulkCreate(cafeId, cups);

    const hasDuplicates = duplicates.length > 0;

    return res.status(hasDuplicates ? 207 : 201).json({
      message: hasDuplicates
        ? `${total} cup(s) added to "${cafe.name}". ${duplicates.length} duplicate barcode(s) were skipped.`
        : `${total} cup(s) added to "${cafe.name}" successfully.`,
      cafe: { id: cafe._id, name: cafe.name },
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
