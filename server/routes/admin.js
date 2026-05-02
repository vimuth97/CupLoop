const express = require("express");
const authenticate = require("../middleware/authenticate");
const requireRole = require("../middleware/requireRole");
const CafeService = require("../services/CafeService");
const CupService = require("../services/CupService");
const errorResponse = require("../utils/errorResponse");

const router = express.Router();

router.use(authenticate, requireRole("admin"));

// GET /api/admin/dashboard
router.get("/dashboard", async (req, res, next) => {
  try {
    const [cupSummary, cafeSummary, lowInventoryCafes] = await Promise.all([
      CupService.getStatusSummary(),
      CafeService.getRegistrationSummary(),
      CafeService.getCafesLowOnCups(100)
    ]);
    return res.status(200).json({
      cups: cupSummary,
      cafes: cafeSummary,
      alerts: { lowInventoryCafes: { threshold: 100, count: lowInventoryCafes.length, cafes: lowInventoryCafes } }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/cafes/pending
router.get("/cafes/pending", async (req, res, next) => {
  try {
    const cafes = await CafeService.getPendingCafes();
    return res.status(200).json({ count: cafes.length, cafes });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/cafes/:cafeId/approve
router.put("/cafes/:cafeId/approve", async (req, res, next) => {
  try {
    const cafe = await CafeService.approveCafe(req.params.cafeId);
    return res.status(200).json({
      message: "Cafe approved successfully",
      cafe: { id: cafe._id, name: cafe.name, location: cafe.location, contactInfo: cafe.contactInfo, activeStatus: cafe.activeStatus, approvedAt: cafe.approvedAt }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/cafes/:cafeId/reject
router.put("/cafes/:cafeId/reject", async (req, res, next) => {
  try {
    const { reason } = req.body;

    if (!reason || typeof reason !== "string" || reason.trim().length === 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { reason: "A rejection reason is required" }));

    const cafe = await CafeService.rejectCafe(req.params.cafeId, reason.trim());
    return res.status(200).json({
      message: "Cafe registration rejected",
      cafe: { id: cafe._id, name: cafe.name, activeStatus: cafe.activeStatus, rejectedReason: cafe.rejectedReason }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/cups/bulk
router.post("/cups/bulk", async (req, res, next) => {
  try {
    const { cafeId, barcodes, materialType } = req.body;

    if (!cafeId || typeof cafeId !== "string" || cafeId.trim().length === 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { cafeId: "cafeId is required" }));
    if (!Array.isArray(barcodes) || barcodes.length === 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { barcodes: "barcodes must be a non-empty array of strings" }));
    if (barcodes.length > 500)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Maximum 500 cups can be added in a single request"));

    const itemErrors = [];
    barcodes.forEach((barcode, index) => {
      if (!barcode || typeof barcode !== "string" || barcode.trim().length === 0)
        itemErrors.push(`barcodes[${index}]: must be a non-empty string`);
    });
    if (itemErrors.length > 0)
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "One or more barcodes are invalid", { items: itemErrors }));

    const cafe = await CafeService.findById(cafeId);
    if (!cafe)
      return res.status(404).json(errorResponse("CAFE_NOT_FOUND", "No cafe found with the provided cafeId"));

    const cups = barcodes.map((barcode) => ({ barcode, materialType: materialType || undefined }));
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

// GET /api/admin/cups/retired
router.get("/cups/retired", async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !["damaged", "lost"].includes(status))
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { status: 'status must be "damaged" or "lost"' }));

    const cups = await CupService.getRetiredCups(status);
    return res.status(200).json({ count: cups.length, filter: status || "damaged,lost", cups });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/cups/retired/bulk
router.delete("/cups/retired/bulk", async (req, res, next) => {
  try {
    const { status } = req.query;

    if (status && !["damaged", "lost"].includes(status))
      return res.status(400).json(errorResponse("VALIDATION_ERROR", "Invalid input", { status: 'status must be "damaged" or "lost"' }));

    const { deleted } = await CupService.bulkDeleteRetired(status);
    return res.status(200).json({ message: `${deleted} cup(s) permanently removed from the system`, deleted, filter: status || "damaged,lost" });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/cups/:cupId
router.delete("/cups/:cupId", async (req, res, next) => {
  try {
    const cup = await CupService.deleteCup(req.params.cupId);
    return res.status(200).json({
      message: `Cup "${cup.barcode}" has been permanently removed from the system`,
      removed: { id: cup._id, barcode: cup.barcode, status: cup.status, materialType: cup.materialType }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
