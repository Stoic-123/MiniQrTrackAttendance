const { pool } = require("../config/db");
const QRCode = require("qrcode");
const geolib = require("geolib");
const moment = require("moment");

// Company's location (latitude and longitude)
const COMPANY_LOCATION = {
  latitude: 11.572487157375708,
  longitude: 104.89329756764403,
};

// Allowed radius in meters
const ALLOWED_RADIUS = 100;

// Function to validate user's location
const validateLocation = (userLatitude, userLongitude) => {
  const userLocation = { latitude: userLatitude, longitude: userLongitude };
  const distance = geolib.getDistance(COMPANY_LOCATION, userLocation);
  return distance <= ALLOWED_RADIUS;
};

const scanQR = async (req, res) => {
  const { code, staff_id, latitude, longitude } = req.body;

  // Validate required fields
  if (!code || !staff_id || !latitude || !longitude) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  // Validate location
  if (!validateLocation(latitude, longitude)) {
    return res.status(403).json({
      error: "QR code can only be scanned within the company premises.",
    });
  }

  const scanTime = moment();
  const hours = scanTime.hour();
  const minutes = scanTime.minute();
  const dayOfWeek = scanTime.day();
  const date = scanTime.format("YYYY-MM-DD");
  const timeString = scanTime.format("HH:mm:ss");

  // Check if it's a weekday
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return res.status(403).json({
      error: "Scanning is only allowed on weekdays (Monday to Friday).",
    });
  }

  // Determine the shift
  let shift;
  if (hours >= 8 && hours < 12) {
    shift = "morning";
  } else if (hours >= 13 && hours < 23) {
    shift = "afternoon";
  } else {
    return res
      .status(400)
      .json({ error: "Scanning is only allowed during working hours." });
  }

  try {
    // Check if the QR code is valid
    const qrQuery = "SELECT * FROM qrcode WHERE code = ? AND expiresAt > NOW()";
    const [qrResult] = await pool.query(qrQuery, [code]);

    if (!Array.isArray(qrResult) || qrResult.length === 0) {
      return res.status(400).json({ error: "Invalid or expired QR code" });
    }

    // Check if an attendance record exists for today
    const attendanceQuery = `
      SELECT attendance_id 
      FROM tbl_attendance 
      WHERE staff_id = ? AND date = ?
    `;
    const [attendanceResult] = await pool.query(attendanceQuery, [staff_id, date]);

    let attendanceId;
    if (!Array.isArray(attendanceResult) || attendanceResult.length === 0) {
      const insertAttendanceQuery = `
        INSERT INTO tbl_attendance (staff_id, date) 
        VALUES (?, ?)
      `;
      const [insertResult] = await pool.query(insertAttendanceQuery, [staff_id, date]);
      attendanceId = insertResult.insertId;
    } else {
      attendanceId = attendanceResult[0].attendance_id;
    }

    // Check if the user has already scanned for the current shift
    const shiftScansQuery = `
      SELECT scan_type, status 
      FROM tbl_attendance_scan 
      WHERE attendance_id = ? AND scan_type IN (?, ?)
    `;
    const [shiftScansResult] = await pool.query(shiftScansQuery, [
      attendanceId,
      `${shift}_checkin`,
      `${shift}_checkout`,
    ]);

    // Check if the user is already marked as absent for check-in
    const checkInAbsent = shiftScansResult.some(
      (scan) => scan.scan_type === `${shift}_checkin` && scan.status === "absent"
    );

    if (checkInAbsent) {
      return res.status(403).json({
        error: `You are marked as absent for ${shift} check-in and cannot check out.`,
      });
    }

    // Determine the scan type based on existing scans
    let scanType;
    if (
      shiftScansResult.some((scan) => scan.scan_type === `${shift}_checkin`) &&
      !shiftScansResult.some((scan) => scan.scan_type === `${shift}_checkout`)
    ) {
      scanType = `${shift}_checkout`;
    } else if (
      !shiftScansResult.some((scan) => scan.scan_type === `${shift}_checkin`)
    ) {
      scanType = `${shift}_checkin`;
    } else {
      return res.status(403).json({
        error: `You have already completed scanning for the ${shift} shift.`,
      });
    }

    // Determine the status based on the scan time
    let status;
    if (scanType === "morning_checkin") {
      if (hours < 8) status = "early";
      else if (hours === 8 && minutes <= 15) status = "ontime";
      else if (hours >= 9) status = "absent";
      else status = "late";
    } else if (scanType === "morning_checkout") {
      if (hours < 12) status = "early";
      else if (hours === 12 && minutes <= 15) status = "ontime";
      else if (hours >= 12 && minutes <= 45) {
        status = "late";
      } else {
        status = "late";
      }
    } else if (scanType === "afternoon_checkin") {
      if (hours < 13) status = "early";
      else if (hours === 13 && minutes <= 15) status = "ontime";
      else if (hours >= 15) status = "absent";
      else status = "late";
    } else if (scanType === "afternoon_checkout") {
      if (hours < 17) status = "early";
      else if (hours === 17 && minutes <= 15) status = "ontime";
      else if (hours >= 17 && minutes > 15) {
        status = "late";
      } else {
        status = "late";
      }
    }

    const formattedScanTime = scanTime.format("YYYY-MM-DD HH:mm:ss");

    // Insert the scan record
    const insertScanQuery = `
      INSERT INTO tbl_attendance_scan 
        (attendance_id, scan_type, scan_time, status) 
      VALUES (?, ?, ?, ?)
    `;
    await pool.query(insertScanQuery, [attendanceId, scanType, formattedScanTime, status]);

    res.json({
      message: `Scanned successfully for ${scanType}.`,
      scanTime: timeString,
      status,
      scanType,
    });
  } catch (error) {
    console.error("Database error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request" });
  }
};

const generateQR = async (req, res) => {
  const code = Math.random().toString(36).substring(7); // Generate a random code
  const expiresAt = new Date(Date.now() + 4 * 365 * 24 * 60 * 60 * 1000); // Expires in 4 years

  try {
    // Data for third-party apps (URL)
    const baseUrl = "http://localhost:9090/scan"; // Replace with your actual URL
    const qrDataForThirdParty = `${baseUrl}?code=${code}`;

    // Data for system scanning (structured JSON)
    const qrDataForSystem = JSON.stringify({ code, expiresAt });

    // Generate QR code image with the URL (for third-party apps)
    const qrImage = await QRCode.toDataURL(qrDataForThirdParty);

    // Store the QR code and image URL in the database
    await pool.query(
      "INSERT INTO QRCode (code, expiresAt, qrImage) VALUES (?, ?, ?)",
      [code, expiresAt, qrImage]
    );

    res.json({ qrImage, code, url: qrDataForThirdParty, qrDataForSystem });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
};

const getLatestQR = async (req, res) => {
  try {
    const sql =
      "SELECT qrImage FROM QRCode WHERE expiresAt > NOW() ORDER BY id DESC LIMIT 1";
    
    // Execute the query using the query function
    const [results] = await pool.query(sql);

    // Check if results is an array and has at least one element
    if (!Array.isArray(results) || results.length === 0) {
      return res.status(404).json({ error: "No active QR code found" });
    }

    // Return the qrImage from the first row
    res.json({ qrImage: results[0].qrImage });
  } catch (error) {
    console.error("Error in getLatestQR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { generateQR, scanQR, getLatestQR };