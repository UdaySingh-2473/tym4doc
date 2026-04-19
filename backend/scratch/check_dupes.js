const mongoose = require('mongoose');
const uri = 'mongodb://localhost:27017/newproject1';
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const Doctor = require('../models/Doctor');

(async () => {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const checkDupes = async (Model, name) => {
      const dupes = await Model.aggregate([
        { $group: { _id: '$email', count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } }
      ]);
      console.log(`Duplicates in ${name}:`, dupes);
    };

    await checkDupes(Patient, 'patients');
    await checkDupes(Clinic, 'clinics');
    await checkDupes(Doctor, 'doctors');

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
})();
