import * as Report from "../models/reportModel.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
});

// GET /dashboard
export async function getDashboard(req, res) {
  if (!req.isAuthenticated()) return res.redirect("/login");
  try {
    const reports = await Report.getAllReports();
    const votedIds = await Report.getVotedIds(req.user.id);
    res.render("dashboard.ejs", {
      reports,
      user: req.user,
      votedIds
    });
  } catch (err) {
    console.log(err);
  }
}

// POST /report — submit a new report
export async function createReport(req, res) {
  if (!req.isAuthenticated()) return res.redirect("/login");
  const { title, description, category, address } = req.body;
  const image = req.file ? req.file.filename : null;
  const latitude = req.body.latitude !== "" ? parseFloat(req.body.latitude) : null;
  const longitude = req.body.longitude !== "" ? parseFloat(req.body.longitude) : null;
  const dangerLevel = await getDangerLevel(title, description);
  try {
    await Report.createReport(
      req.user.id, title, description, category,
      image, dangerLevel, address, latitude, longitude
    );
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
  }
}

// POST /report/delete/:id
export async function deleteReport(req, res) {
  if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
  try {
    await Report.deleteReport(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.log(err);
  }
}

// POST /report/solve/:id
export async function solveReport(req, res) {
  if (!req.isAuthenticated() || req.user.role !== "admin") return res.redirect("/dashboard");
  try {
    await Report.solveReport(req.params.id);

    // Send email notification
    const report = await Report.getReportById(req.params.id);
    await transporter.sendMail({
      from: `"County Reports" <${process.env.EMAIL_USER}>`,
      to: report.email,
      subject: "✅ Your report has been solved!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #198754;">✅ Report Solved!</h2>
          <p>Hello,</p>
          <p>Your report has been reviewed and marked as solved by our team.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Title:</strong> ${report.title}</p>
            <p><strong>Category:</strong> ${report.category}</p>
            <p><strong>Description:</strong> ${report.description}</p>
          </div>
          <p>Thank you for helping improve our community!</p>
          <p style="color: #6c757d; font-size: 12px;">— County Reports Team</p>
        </div>
      `
    });
    res.redirect("/admin");
  } catch (err) {
    console.log(err);
  }
}

// POST /report/vote/:id
export async function voteReport(req, res) {
  if (!req.isAuthenticated()) return res.redirect("/login");
  try {
    await Report.toggleVote(req.user.id, req.params.id);
    res.redirect("/dashboard");
  } catch (err) {
    console.log(err);
  }
}

// ─── OLLAMA HELPER ───────────────────────────────────────
async function getDangerLevel(title, description) {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt: `You are a system that classifies the danger level of community problem reports.
Based on this report, respond with ONLY one word: high, medium, or low.

Rules:
- high: immediate danger to people (fire, flood, gas leak, collapsed structure, fallen tree blocking road)
- medium: potential danger or major inconvenience (broken road, damaged infrastructure, clogged drain)
- low: minor issues (graffiti, noise, small potholes, aesthetic problems)

Title: ${title}
Description: ${description}

Respond with only one word (high, medium, or low):`,
        stream: false
      })
    });
    const data = await response.json();
    const result = data.response.trim().toLowerCase();
    if (["high", "medium", "low"].includes(result)) return result;
    return "low";
  } catch (err) {
    console.log("Ollama error:", err);
    return "low";
  }
}3