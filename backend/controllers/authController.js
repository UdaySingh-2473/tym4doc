const bcrypt        = require("bcryptjs");
const crypto        = require("crypto");
const Patient       = require("../models/Patient");
const Clinic        = require("../models/Clinic");
const Doctor        = require("../models/Doctor");
const AuthToken     = require("../models/AuthToken");
const { generateToken } = require("../middleware/auth");
const {
  sendPasswordResetLink,
  sendVerificationEmailLink
} = require("../services/emailService");
const { generateRandomHexToken } = require("../utils/tokenGenerator");


// ============================================================
// PATIENT: REGISTER
// ============================================================

exports.patientRegister = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        error: "Please fill all required fields"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (await Patient.findOne({ email: normalizedEmail })) {
      return res.status(400).json({
        error: "Email already registered. Please sign in."
      });
    }

    const patient = await Patient.create({
      firstName,
      lastName,
      email: normalizedEmail,
      password
    });

    // --------------------------------------------------------
    // Send verification email.
    // If SMTP fails, DO NOT block registration.
    // --------------------------------------------------------
    try {
      await exports.issueVerificationToken(
        normalizedEmail,
        "patient",
        `${firstName} ${lastName}`
      );
    } catch (emailErr) {
      console.error(
        "Patient verification email failed:",
        emailErr.message
      );
    }

    const authToken = generateToken(patient._id, "patient");

    return res.status(201).json({
      token: authToken,
      user: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        email: patient.email,
        role: "patient",
        isEmailVerified: false
      }
    });

  } catch (err) {
    console.error("Patient registration ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// PATIENT: LOGIN
// ============================================================

exports.patientLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter email and password"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const patient = await Patient.findOne({
      email: normalizedEmail
    }).select("+password");

    if (!patient) {
      return res.status(401).json({
        error: "No account found. Please register first."
      });
    }

    const isMatch = await patient.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Incorrect password"
      });
    }

    const token = generateToken(patient._id, "patient");

    return res.json({
      token,
      user: {
        id: patient._id,
        name: `${patient.firstName} ${patient.lastName}`,
        email: patient.email,
        role: "patient",
        isEmailVerified: patient.isEmailVerified
      }
    });

  } catch (err) {
    console.error("Patient login ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// CLINIC: REGISTER
// ============================================================

exports.clinicRegister = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      address,
      city,
      state,
      location,
      description,
      documents
    } = req.body;

    if (!name || !email || !password || !address || !city || !state) {
      return res.status(400).json({
        error: "Please fill all required fields"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (await Clinic.findOne({ email: normalizedEmail })) {
      return res.status(400).json({
        error: "Email already registered"
      });
    }

    const clinic = await Clinic.create({
      name,
      email: normalizedEmail,
      phone,
      password,
      address,
      city,
      state,
      location,
      description,
      documents
    });

    // --------------------------------------------------------
    // Send verification email.
    // If SMTP fails, DO NOT block registration.
    // --------------------------------------------------------
    try {
      await exports.issueVerificationToken(
        normalizedEmail,
        "clinic",
        name
      );
    } catch (emailErr) {
      console.error(
        "Clinic verification email failed:",
        emailErr.message
      );
    }

    const authToken = generateToken(clinic._id, "clinic");

    return res.status(201).json({
      token: authToken,
      user: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        role: "clinic",
        status: clinic.status,
        isEmailVerified: false
      }
    });

  } catch (err) {
    console.error("Clinic registration ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// CLINIC: LOGIN
// ============================================================

exports.clinicLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter email and password"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const clinic = await Clinic.findOne({
      email: normalizedEmail
    }).select("+password");

    if (!clinic) {
      return res.status(401).json({
        error: "Email not found. Please register first."
      });
    }

    const isMatch = await clinic.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Incorrect password"
      });
    }

    const token = generateToken(clinic._id, "clinic");

    return res.json({
      token,
      user: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        role: "clinic",
        status: clinic.status,
        isEmailVerified: clinic.isEmailVerified
      }
    });

  } catch (err) {
    console.error("Clinic login ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// DOCTOR: LOGIN
// ============================================================

exports.doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Please enter email and password"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const doctor = await Doctor.findOne({
      email: normalizedEmail
    }).select("+password");

    if (!doctor) {
      return res.status(401).json({
        error: "Doctor account not found."
      });
    }

    const isMatch = await doctor.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        error: "Incorrect password"
      });
    }

    const token = generateToken(doctor._id, "doctor");

    return res.json({
      token,
      user: {
        id: doctor._id,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        email: doctor.email,
        role: "doctor",
        clinicId: doctor.clinicId,
        isEmailVerified: doctor.isEmailVerified
      }
    });

  } catch (err) {
    console.error("Doctor login ERROR:", err);
    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// RESEND VERIFICATION
// ============================================================

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.user;
    const role = req.role;

    if (!email || !role) {
      return res.status(400).json({
        error: "Could not identify user email or role."
      });
    }

    const name =
      role === "clinic"
        ? req.user.name
        : role === "doctor"
          ? `Dr. ${req.user.firstName} ${req.user.lastName}`
          : `${req.user.firstName} ${req.user.lastName}`;

    await exports.issueVerificationToken(
      email,
      role,
      name
    );

    return res.json({
      message: "A verification link has been sent to " + email
    });

  } catch (err) {
    console.error("Resend verification ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// ADMIN: LOGIN
// ============================================================

exports.adminLogin = (req, res) => {
  try {
    const { email, password } = req.body;

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (
      email?.trim().toLowerCase() ===
        adminEmail?.trim().toLowerCase() &&
      password?.trim() ===
        adminPass?.trim()
    ) {
      const token = generateToken("admin", "admin");

      return res.json({
        token,
        user: {
          name: "Admin",
          email: adminEmail,
          role: "admin"
        }
      });
    }

    return res.status(401).json({
      error: "Invalid admin credentials"
    });

  } catch (err) {
    console.error("Admin login ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// ISSUE VERIFICATION TOKEN
// ============================================================

exports.issueVerificationToken = async (
  email,
  role,
  name
) => {

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await AuthToken.findOne({
    email: normalizedEmail,
    purpose: "verify"
  });

  // 30-second throttle
  if (
    existing &&
    existing.createdAt &&
    Date.now() - existing.createdAt < 30000
  ) {
    return existing;
  }

  const tokenStr = generateRandomHexToken();

  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  const token = await AuthToken.findOneAndUpdate(
    {
      email: normalizedEmail,
      purpose: "verify"
    },
    {
      token: tokenStr,
      role,
      expiresAt,
      createdAt: new Date()
    },
    {
      upsert: true,
      new: true
    }
  );

  // ----------------------------------------------------------
  // IMPORTANT:
  // SMTP errors are allowed to propagate to the caller.
  // Registration catches them so registration doesn't hang.
  // ----------------------------------------------------------

  await sendVerificationEmailLink(
    normalizedEmail,
    tokenStr,
    role,
    name
  );

  return token;
};


// ============================================================
// FORGOT PASSWORD
// ============================================================

exports.forgotPassword = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        error: "Email and role are required"
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const Model =
      role === "clinic"
        ? Clinic
        : role === "doctor"
          ? Doctor
          : Patient;

    const user = await Model.findOne({
      email: normalizedEmail
    });

    if (!user) {
      return res.status(404).json({
        error: "No account found with this email"
      });
    }

    const token = generateRandomHexToken();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    await AuthToken.findOneAndUpdate(
      {
        email: normalizedEmail,
        purpose: "reset"
      },
      {
        token,
        role,
        expiresAt,
        verified: false
      },
      {
        upsert: true,
        new: true
      }
    );

    const name =
      role === "clinic"
        ? user.name
        : role === "doctor"
          ? `Dr. ${user.firstName} ${user.lastName}`
          : `${user.firstName} ${user.lastName}`;

    await sendPasswordResetLink(
      normalizedEmail,
      token,
      role,
      name
    );

    return res.json({
      message:
        "Password reset link sent to " +
        normalizedEmail
    });

  } catch (err) {
    console.error(
      "Forgot password ERROR:",
      err
    );

    return res.status(500).json({
      error: `Reset failed: ${err.message}`
    });
  }
};


// ============================================================
// RESET PASSWORD
// ============================================================

exports.resetPassword = async (req, res) => {
  try {
    const {
      token,
      newPassword,
      role
    } = req.body;

    if (!token || !newPassword || !role) {
      return res.status(400).json({
        error:
          "Token, role, and new password are required"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters"
      });
    }

    const record = await AuthToken.findOne({
      token,
      role,
      purpose: "reset"
    });

    if (!record) {
      return res.status(400).json({
        error:
          "Invalid or expired reset token. Please request a new link."
      });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({
        error:
          "Reset link has expired. Please request a new one."
      });
    }

    const Model =
      role === "clinic"
        ? Clinic
        : role === "doctor"
          ? Doctor
          : Patient;

    const user = await Model.findOne({
      email: record.email
    }).select("+password");

    if (!user) {
      return res.status(404).json({
        error: "Account not found"
      });
    }

    user.password = newPassword;

    await user.save();

    await AuthToken.deleteOne({
      _id: record._id
    });

    return res.json({
      message:
        "Password reset successfully. You can now sign in."
    });

  } catch (err) {
    console.error(
      "Reset password ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// VERIFY EMAIL
// ============================================================

exports.verifyEmail = async (req, res) => {
  try {
    let { token, role } = req.query;

    token = token?.trim();
    role = role?.trim();

    if (!token || !role) {
      return res.status(400).json({
        error: "Token and role are required"
      });
    }

    const record = await AuthToken.findOne({
      token,
      role,
      purpose: "verify"
    });

    if (!record) {
      return res.status(400).json({
        error:
          "Verification link not found. It may have been used or expired."
      });
    }

    if (record.expiresAt < new Date()) {

      await AuthToken.deleteOne({
        _id: record._id
      });

      return res.status(400).json({
        error:
          "Verification link has expired (10 min limit). Please request a new one."
      });
    }

    const Model =
      role === "clinic"
        ? Clinic
        : role === "doctor"
          ? Doctor
          : Patient;

    const user = await Model.findOneAndUpdate(
      {
        email: record.email
      },
      {
        isEmailVerified: true
      },
      {
        new: true
      }
    );

    if (!user) {
      return res.status(400).json({
        error:
          "Associated user account not found."
      });
    }

    await AuthToken.deleteOne({
      _id: record._id
    });

    return res.json({
      message:
        "Email verified successfully! You can now use all features."
    });

  } catch (err) {
    console.error(
      "Verification error:",
      err.message
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// CHANGE PASSWORD
// ============================================================

exports.changePassword = async (req, res) => {
  try {
    const {
      currentPassword,
      newPassword
    } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error:
          "Current and new passwords are required"
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error:
          "New password must be at least 8 characters"
      });
    }

    const Model =
      req.role === "clinic"
        ? Clinic
        : req.role === "doctor"
          ? Doctor
          : Patient;

    const user = await Model.findById(
      req.user._id
    ).select("+password");

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    if (
      !(await user.matchPassword(currentPassword))
    ) {
      return res.status(401).json({
        error: "Current password is incorrect"
      });
    }

    user.password = newPassword;

    await user.save();

    return res.json({
      message:
        "Password changed successfully"
    });

  } catch (err) {
    console.error(
      "Change password ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// UPDATE PATIENT PROFILE
// ============================================================

exports.updatePatientProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone
    } = req.body;

    const updates = {};

    if (firstName) {
      updates.firstName = firstName;
    }

    if (lastName) {
      updates.lastName = lastName;
    }

    if (phone) {
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          error: "Phone must be 10 digits"
        });
      }

      updates.phone = phone;
    }

    const { email } = req.body;

    if (
      email &&
      email.toLowerCase() !== req.user.email
    ) {

      const normalizedEmail =
        email.toLowerCase().trim();

      if (
        await Patient.findOne({
          email: normalizedEmail
        })
      ) {
        return res.status(400).json({
          error: "Email already in use"
        });
      }

      updates.email = normalizedEmail;
      updates.isEmailVerified = false;

      try {
        await exports.issueVerificationToken(
          normalizedEmail,
          "patient",
          `${req.user.firstName} ${req.user.lastName}`
        );
      } catch (emailErr) {
        console.error(
          "Patient profile verification email failed:",
          emailErr.message
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No fields to update"
      });
    }

    const patient =
      await Patient.findByIdAndUpdate(
        req.user._id,
        updates,
        {
          new: true,
          runValidators: true
        }
      );

    if (!patient) {
      return res.status(404).json({
        error: "Patient not found"
      });
    }

    return res.json({
      message:
        email &&
        email.toLowerCase() !== req.user.email
          ? "Profile updated. Please verify your new email."
          : "Profile updated successfully",

      user: {
        id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        isEmailVerified:
          patient.isEmailVerified
      }
    });

  } catch (err) {
    console.error(
      "Update patient profile ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// UPDATE CLINIC PROFILE
// ============================================================

exports.updateClinicProfile = async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      city,
      state,
      description,
      location,
      maxBookingDays
    } = req.body;

    const updates = {};

    if (name) {
      updates.name = name;
    }

    if (phone) {
      if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({
          error: "Phone must be 10 digits"
        });
      }

      updates.phone = phone;
    }

    const { email } = req.body;

    if (
      email &&
      email.toLowerCase() !== req.user.email
    ) {

      const normalizedEmail =
        email.toLowerCase().trim();

      if (
        await Clinic.findOne({
          email: normalizedEmail
        })
      ) {
        return res.status(400).json({
          error: "Email already in use"
        });
      }

      updates.email = normalizedEmail;
      updates.isEmailVerified = false;

      try {
        await exports.issueVerificationToken(
          normalizedEmail,
          "clinic",
          req.user.name
        );
      } catch (emailErr) {
        console.error(
          "Clinic profile verification email failed:",
          emailErr.message
        );
      }
    }

    if (address) {
      updates.address = address;
    }

    if (city) {
      updates.city = city;
    }

    if (state) {
      updates.state = state;
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (location) {
      updates.location = location;
    }

    if (maxBookingDays !== undefined) {

      if (Number(maxBookingDays) < 1) {
        return res.status(400).json({
          error:
            "Maximum Booking Days must be at least 1"
        });
      }

      updates.maxBookingDays =
        Number(maxBookingDays);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "No fields to update"
      });
    }

    const clinic =
      await Clinic.findByIdAndUpdate(
        req.user._id,
        updates,
        {
          new: true,
          runValidators: true
        }
      );

    if (!clinic) {
      return res.status(404).json({
        error: "Clinic not found"
      });
    }

    return res.json({
      message:
        "Profile updated successfully",

      user: {
        id: clinic._id,
        name: clinic.name,
        email: clinic.email,
        phone: clinic.phone,
        address: clinic.address,
        city: clinic.city,
        state: clinic.state,
        description: clinic.description,
        role: "clinic",
        status: clinic.status
      }
    });

  } catch (err) {
    console.error(
      "Update clinic profile ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// GET PATIENT PROFILE
// ============================================================

exports.getPatientProfile = async (req, res) => {
  try {

    const patient =
      await Patient.findById(
        req.user._id
      );

    if (!patient) {
      return res.status(404).json({
        error: "Patient not found"
      });
    }

    return res.json({
      id: patient._id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email,
      phone: patient.phone,
      isEmailVerified:
        patient.isEmailVerified
    });

  } catch (err) {

    console.error(
      "Get patient profile ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// GET CLINIC PROFILE
// ============================================================

exports.getClinicProfile = async (req, res) => {
  try {

    const clinic =
      await Clinic.findById(
        req.user._id
      );

    if (!clinic) {
      return res.status(404).json({
        error: "Clinic not found"
      });
    }

    return res.json({
      id: clinic._id,
      name: clinic.name,
      email: clinic.email,
      phone: clinic.phone,
      address: clinic.address,
      city: clinic.city,
      state: clinic.state,
      description: clinic.description,
      status: clinic.status,
      maxBookingDays:
        clinic.maxBookingDays,
      isEmailVerified:
        clinic.isEmailVerified
    });

  } catch (err) {

    console.error(
      "Get clinic profile ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// GET DOCTOR PROFILE
// ============================================================

exports.getDoctorProfile = async (req, res) => {
  try {

    const doctor =
      await Doctor.findById(
        req.user._id
      ).populate(
        "clinicId",
        "name city address"
      );

    if (!doctor) {
      return res.status(404).json({
        error: "Doctor not found"
      });
    }

    return res.json(doctor);

  } catch (err) {

    console.error(
      "Get doctor profile ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


// ============================================================
// ADMIN: GET ALL PATIENTS
// ============================================================

exports.getAdminPatients = async (req, res) => {
  try {

    const Appointment =
      require("../models/Appointment");

    const patients =
      await Patient.find({})
        .select("-password")
        .lean();

    const enhanced =
      await Promise.all(
        patients.map(
          async (p) => {

            if (p.phone) {
              return {
                ...p,
                lastUsedPhone: p.phone
              };
            }

            const lastAppt =
              await Appointment.findOne({
                patientId: p._id
              })
              .sort({
                createdAt: -1
              });

            return {
              ...p,
              lastUsedPhone:
                lastAppt
                  ? lastAppt.patientPhone
                  : null
            };
          }
        )
      );

    return res.json(enhanced);

  } catch (err) {

    console.error(
      "Get admin patients ERROR:",
      err
    );

    return res.status(500).json({
      error: err.message
    });
  }
};


