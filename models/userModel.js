import db from "../db.js";

// Find a user by email
export async function findUserByEmail(email) {
  const result = await db.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
}

// Create a new user
export async function createUser(email, hashedPassword) {
  const result = await db.query(
    "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
    [email, hashedPassword]
  );
  return result.rows[0];
}

// Delete a user by id
export async function deleteUser(userId) {
  await db.query("DELETE FROM users WHERE id = $1", [userId]);
}

// Get all users with their report count (for admin)
export async function getAllUsers() {
  const result = await db.query(
    `SELECT users.*, COUNT(reports.id) AS report_count 
     FROM users 
     LEFT JOIN reports ON users.id = reports.user_id 
     GROUP BY users.id 
     ORDER BY users.created_at DESC`
  );
  return result.rows;
}

// Get total user count (for admin stats)
export async function getTotalUsers() {
  const result = await db.query("SELECT COUNT(*) FROM users");
  return result.rows[0].count;
}