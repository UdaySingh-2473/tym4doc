require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Clinic = require("./models/Clinic");

const checkClinics = async () => {
  await connectDB();
  const clinics = await Clinic.find({}).limit(5).select("+password");
  console.log(JSON.stringify(clinics, null, 2));
  process.exit();
};

checkClinics();
