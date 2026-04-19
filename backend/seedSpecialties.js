const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const Specialty = require("./models/Specialty");

// Load env
dotenv.config({ path: path.join(__dirname, ".env") });

const SPECIALTIES_DATA = [
  { name: "Cardiology", description: "Heart and blood vessels" },
  { name: "Neurology", description: "Brain and nervous system" },
  { name: "General Medicine", description: "General health and primary care" },
  { name: "Dermatology", description: "Skin, hair, and nails" },
  { name: "Pediatrics", description: "Medical care for infants, children, and adolescents" },
  { name: "Orthopedics", description: "Musculoskeletal system (bones and joints)" },
  { name: "Psychiatry", description: "Mental health and behavioral disorders" },
  { name: "Gynecology", description: "Female reproductive health and pregnancy" },
  { name: "Ophthalmology", description: "Eye and vision care" },
  { name: "ENT", description: "Ear, Nose, and Throat specialists" },
  { name: "Urology", description: "Urinary tract and male reproductive organs" },
  { name: "Oncology", description: "Cancer diagnosis and treatment" },
  { name: "Dentistry", description: "Comprehensive care for teeth, gums, and oral health" },
  { name: "Physiotherapy", description: "Physical rehabilitation and movement therapy" },
  { name: "Gastroenterology", description: "Digestive system, stomach, and intestines" },
  { name: "Endocrinology", description: "Hormones and metabolic disorders" },
  { name: "Pulmonology", description: "Lungs and respiratory system health" },
  { name: "Nephrology", description: "Kidney function and kidney diseases" },
  { name: "Radiology", description: "Diagnosis using medical imaging (MRI, CT, X-ray)" },
  { name: "Homeopathy", description: "Holistic treatment using natural substances" },
  { name: "Ayurveda", description: "Traditional Indian holistic medicine" },
  { name: "Dietician", description: "Nutrition and diet planning for wellness" },
  { name: "Rheumatology", description: "Joint, muscle, and autoimmune disorders" },
  { name: "Hematology", description: "Blood and blood-forming tissue disorders" },
  { name: "Infectious Disease", description: "Complex viral and bacterial infections" },
  { name: "Plastic Surgery", description: "Reconstructive and aesthetic procedures" },
  { name: "Neurosurgery", description: "Surgical treatment of the brain and spine" },
];

async function seed() {
  try {
    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/newproject1";
    console.log(`Connecting to: ${uri}...`);
    
    await mongoose.connect(uri);
    console.log("MongoDB Connected");

    // Clear existing
    await Specialty.deleteMany({});
    console.log("Cleared existing specialties");

    // Insert new
    await Specialty.insertMany(SPECIALTIES_DATA);
    console.log(`Successfully seeded ${SPECIALTIES_DATA.length} specialties!`);

    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
