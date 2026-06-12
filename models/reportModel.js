import db from "../db.js"; // make sure this only appears ONCE

// Get all reports with user email, ordered by votes then date
export async function getAllReports() {
  const result = await db.query(
    `SELECT reports.*, users.email 
     FROM reports 
     JOIN users ON reports.user_id = users.id 
     ORDER BY reports.votes DESC, reports.created_at DESC`
  );
  return result.rows;
}

// Get all report IDs that a specific user has voted for
export async function getVotedIds(userId) {
  const result = await db.query(
    "SELECT report_id FROM report_votes WHERE user_id = $1",
    [userId]
  );
  return result.rows.map(r => r.report_id);
}

// Create a new report
export async function createReport(userId, title, description, category, image, dangerLevel, address, latitude, longitude) {
  await db.query(
    `INSERT INTO reports 
      (user_id, title, description, category, image, danger_level, address, latitude, longitude) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [userId, title, description, category, image, dangerLevel, address, latitude, longitude]
  );
}

// Delete a report
export async function deleteReport(reportId) {
  await db.query("DELETE FROM reports WHERE id = $1", [reportId]);
}

// Mark a report as solved
export async function solveReport(reportId) {
  await db.query(
    "UPDATE reports SET status = 'solved' WHERE id = $1",
    [reportId]
  );
}

// Get a single report with the user email (used for email notification)
export async function getReportById(reportId) {
  const result = await db.query(
    `SELECT reports.*, users.email 
     FROM reports 
     JOIN users ON reports.user_id = users.id 
     WHERE reports.id = $1`,
    [reportId]
  );
  return result.rows[0];
}

// Vote on a report (toggle — vote or unvote)
export async function toggleVote(userId, reportId) {
  const existing = await db.query(
    "SELECT * FROM report_votes WHERE user_id = $1 AND report_id = $2",
    [userId, reportId]
  );

  if (existing.rows.length > 0) {
    // Already voted → remove vote
    await db.query(
      "DELETE FROM report_votes WHERE user_id = $1 AND report_id = $2",
      [userId, reportId]
    );
    await db.query(
      "UPDATE reports SET votes = votes - 1 WHERE id = $1",
      [reportId]
    );
  } else {
    // Not voted yet → add vote
    await db.query(
      "INSERT INTO report_votes (user_id, report_id) VALUES ($1, $2)",
      [userId, reportId]
    );
    await db.query(
      "UPDATE reports SET votes = votes + 1 WHERE id = $1",
      [reportId]
    );
  }
}

// Get total report count (for admin stats)
export async function getTotalReports() {
  const result = await db.query("SELECT COUNT(*) FROM reports");
  return result.rows[0].count;
}

// Get open report count (for admin stats)
export async function getOpenReports() {
  const result = await db.query("SELECT COUNT(*) FROM reports WHERE status = 'open'");
  return result.rows[0].count;
}

// Get solved report count (for admin stats)
export async function getSolvedReports() {
  const result = await db.query("SELECT COUNT(*) FROM reports WHERE status = 'solved'");
  return result.rows[0].count;
}