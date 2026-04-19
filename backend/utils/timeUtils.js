/**
 * Formats "HH:MM" (24h) into "HH:MM AM/PM" (12h)
 */
const formatTime12 = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  let hh = parseInt(h);
  const mmm = m || "00";
  const mer = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mmm} ${mer}`;
};

/**
 * Formats a single 24h time string (e.g., "10:25") into a range (e.g., "10:25 AM - 10:30 AM")
 * based on the doctor's slot duration (in minutes).
 */
const formatSlotRange = (startTime24, duration = 30) => {
  if (!startTime24) return "";
  
  try {
    const [h, m] = startTime24.split(":").map(Number);
    let date = new Date();
    date.setHours(h);
    date.setMinutes(m);
    date.setSeconds(0);

    const endDate = new Date(date.getTime() + duration * 60000);

    const format = (d) => {
      let hh = d.getHours();
      let mm = d.getMinutes();
      let p = hh >= 12 ? "PM" : "AM";
      hh = hh % 12 || 12;
      return `${hh}:${String(mm).padStart(2, "0")} ${p}`;
    };

    return `${format(date)} - ${format(endDate)}`;
  } catch (err) {
    return startTime24;
  }
};

module.exports = {
  formatTime12,
  formatSlotRange,
};
