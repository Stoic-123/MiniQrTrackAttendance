const { pool } = require("../config/db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, "Long secret", { expiresIn: "2d" });
};

// Signup controller
const signUpPost = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Please provide email and password" });
  }

  try {
    const salt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, salt);

    const sql = "INSERT INTO authqr (email, password) VALUES (?, ?)";
    const [result] = await pool.query(sql, [email, hashPassword]);

    res.json({ message: "User created successfully", userId: result.insertId });
  } catch (err) {
    console.error("Error during signup:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Login controller
const loginPost = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Please provide email and password" });
  }

  try {
    const sql = "SELECT * FROM authqr WHERE email = ?";
    const [data] = await pool.query(sql, [email]);

    if (data.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const comparePassword = await bcrypt.compare(password, data[0].password);

    if (comparePassword) {
      const token = generateToken(data[0].id, data[0].role);

      res.cookie("jwt", token, {
        maxAge: 3 * 24 * 60 * 60 * 1000, // 3 days
        httpOnly: true,
      });

      res.json({
        message: "Login successful",
        token,
        role: data[0].role,
        staff_id: data[0].id,
      });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  } catch (err) {
    console.error("Error during login:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Logout controller
const logout = (req, res) => {
  res.cookie("jwt", "", { maxAge: 1 });
  res.status(200).json({ message: "Logout successful" });
};
module.exports = { signUpPost, loginPost, logout };
