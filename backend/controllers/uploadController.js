const cloudinary = require("../config/cloudinary");

exports.uploadDoctorPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
      return res.status(500).json({ error: "Cloudinary credentials not configured in .env" });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "Tym4DOC/doctors", resource_type: "image", transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }] },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });
    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    console.error("Upload error:", err.message);
    res.status(500).json({ error: err.message || "Upload failed" });
  }
};

exports.testCloudinary = async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
      return res.status(500).json({ ok: false, error: "Cloudinary env vars missing" });
    await cloudinary.api.ping();
    res.json({ ok: true, cloud_name: process.env.CLOUDINARY_CLOUD_NAME, message: "Cloudinary connected!" });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
};
