const Specialty = require("../models/Specialty");

exports.addSpecialty = async (req, res) => {
  try {
    const { name, description, image } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    const exists = await Specialty.findOne({ name: { $regex: new RegExp(`^${name}$`, "i") } });
    if (exists) return res.status(400).json({ error: "Specialty already exists" });
    
    const specialty = await Specialty.create({ name, description, image });
    res.status(201).json({ message: "Specialty added", specialty });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAllSpecialties = async (req, res) => {
  try {
    const specialties = await Specialty.find({});
    res.json(specialties);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
