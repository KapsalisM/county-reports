import express from "express";
import * as adminController from "../controllers/adminController.js";

const router = express.Router();

// ─── ROUTES ──────────────────────────────────────────────

router.get("/admin", adminController.getAdmin);
router.post("/admin/delete-user/:id", adminController.deleteUser);

export default router;