/**
 * Formats a single time string (e.g., "10:25 AM") into a range (e.g., "10:25 AM - 10:30 AM")
 * based on the doctor's slot duration (in minutes).
 */
export const formatSlotRange = (startTimeStr, duration = 30) => {
  if (!startTimeStr) return "";
  
  try {
    // 1. Parse "HH:MM AM/PM"
    const match = startTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return startTimeStr;

    let [_, hours, minutes, period] = match;
    hours = parseInt(hours);
    minutes = parseInt(minutes);

    // 2. Convert to 24h format for calculation
    let date = new Date();
    if (period.toUpperCase() === "PM" && hours < 12) hours += 12;
    if (period.toUpperCase() === "AM" && hours === 12) hours = 0;
    
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);

    // 3. Add duration
    const endDate = new Date(date.getTime() + duration * 60000);

    // 4. Format end time back to AM/PM
    const formatTime = (d) => {
      let h = d.getHours();
      let m = d.getMinutes();
      let p = h >= 12 ? "PM" : "AM";
      h = h % 12;
      h = h === 0 ? 12 : h;
      return `${h}:${String(m).padStart(2, "0")} ${p}`;
    };

    return `${startTimeStr} - ${formatTime(endDate)}`;
  } catch (err) {
    console.error("Error formatting slot range:", err);
    return startTimeStr;
  }
};

/**
 * Formats "HH:MM" (24h) into "HH:MM AM/PM" (12h)
 */
export const formatTime12 = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  let hh = parseInt(h);
  const mmm = m || "00";
  const mer = hh >= 12 ? "PM" : "AM";
  hh = hh % 12 || 12;
  return `${hh}:${mmm} ${mer}`;
};
