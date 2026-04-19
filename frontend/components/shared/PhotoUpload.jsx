import { useState, useRef } from "react";
import { uploadDoctorPhoto } from "../../services/api";
import C from "../../constants/colors";

export default function PhotoUpload({ value, onChange, required = true }) {
  const [preview,    setPreview]  = useState(value || null);
  const [uploading,  setUploading]= useState(false);
  const [error,      setError]    = useState("");
  const inputRef = useRef();

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Only image files are allowed."); return; }
    if (file.size > 5 * 1024 * 1024)    { setError("File too large (max 5 MB).");      return; }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setError("");
    setUploading(true);
    try {
      const res = await uploadDoctorPhoto(file);
      setPreview(res.url);
      onChange(res.url);
    } catch (err) {
      const msg = err.message || "";
      if (msg.includes("401") || msg.includes("403") || msg.includes("credentials") || msg.includes("Cloudinary"))
        setError("Upload failed: Invalid Cloudinary credentials. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env");
      else
        setError("Upload failed: " + (msg || "Please check your backend is running."));
      setPreview(null);
      onChange("");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ marginBottom:13 }}>
      <label style={{ display:"block", fontSize:".78rem", fontWeight:700, color:C.gray700, marginBottom:4, textTransform:"uppercase", letterSpacing:".03em" }}>
        Profile Photo {required && <span style={{ color:"#ef4444" }}>*</span>}
      </label>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => !uploading && inputRef.current.click()}
        style={{
          border:`2px dashed ${error ? "#ef4444" : preview ? "#22c55e" : C.gray300}`,
          borderRadius:10, padding:preview ? 8 : 24,
          textAlign:"center", cursor: uploading ? "wait" : "pointer",
          background: preview ? "#f0fdf4" : "#f8fafc",
          transition:"all .2s",
          display:"flex", flexDirection:"column", alignItems:"center", gap:8,
        }}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Doctor photo"
              style={{ width:100, height:100, borderRadius:"50%", objectFit:"cover", border:`3px solid ${uploading ? C.gray300 : "#22c55e"}` }}
            />
            {uploading ? (
              <span style={{ fontSize:".78rem", color:C.gray500 }}>Uploading to Cloudinary…</span>
            ) : (
              <span style={{ fontSize:".78rem", color:"#16a34a", fontWeight:600 }}>Photo ready — click to change</span>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize:"1rem", fontWeight:800, color:C.blue }}>Photo</div>
            <div style={{ fontSize:".84rem", fontWeight:600, color:C.gray600 }}>Click or drag &amp; drop photo</div>
            <div style={{ fontSize:".74rem", color:C.gray400 }}>JPG, PNG, WEBP · Max 5 MB · Face photo preferred</div>
          </>
        )}
      </div>

      {error && <p style={{ color:"#ef4444", fontSize:".76rem", marginTop:4 }}>{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display:"none" }}
        onChange={e => handleFile(e.target.files[0])}
      />
    </div>
  );
}
