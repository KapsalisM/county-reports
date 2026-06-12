import express from "express";
import multer from "multer";
import path from "path";
import * as reportController from "../controllers/reportController.js";

const router = express.Router();

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: "public/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// ─── ROUTES ──────────────────────────────────────────────

router.get("/dashboard", reportController.getDashboard);
router.post("/report", upload.single("image"), reportController.createReport);
router.post("/report/delete/:id", reportController.deleteReport);
router.post("/report/solve/:id", reportController.solveReport);
router.post("/report/vote/:id", reportController.voteReport);

export default router;