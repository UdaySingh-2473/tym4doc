import { useState } from "react";
import C from "../../constants/colors";

export default function CalendarPicker({ selectedDate, onSelect, minDate, maxDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate || new Date()));

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startDay = firstDayOfMonth(year, month);

  // Buffer for previous month days
  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= totalDays; i++) {
    days.push(i);
  }

  const handlePrev = () => setCurrentMonth(new Date(year, month - 1, 1));
  const handleNext = () => setCurrentMonth(new Date(year, month + 1, 1));

  const isSelected = (d) => {
    if (!selectedDate || !d) return false;
    const sd = new Date(selectedDate);
    return sd.getDate() === d && sd.getMonth() === month && sd.getFullYear() === year;
  };

  const isToday = (d) => {
    const today = new Date();
    return today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
  };

  const isDisabled = (d) => {
    if (!d) return true;
    const date = new Date(year, month, d);
    date.setHours(0,0,0,0);
    
    if (minDate) {
      const min = new Date(minDate);
      min.setHours(0,0,0,0);
      if (date < min) return true;
    }
    if (maxDate) {
      const max = new Date(maxDate);
      max.setHours(23,59,59,999);
      if (date > max) return true;
    }
    return false;
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div style={{ background: C.white, border: `1px solid ${C.gray200}`, borderRadius: 8, padding: 12, width: "100%", maxWidth: 300, boxSizing: "border-box", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <button onClick={handlePrev} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: C.blue }}>&lt;</button>
        <div style={{ fontWeight: 800, fontSize: ".9rem" }}>{monthNames[month]} {year}</div>
        <button onClick={handleNext} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 800, color: C.blue }}>&gt;</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center", fontSize: ".75rem", fontWeight: 700, color: C.gray400, marginBottom: 8 }}>
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => <div key={d}>{d}</div>)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {days.map((d, index) => {
          const disabled = isDisabled(d);
          const selected = isSelected(d);
          const tdy = isToday(d);

          return (
            <div
              key={index}
              onClick={() => !disabled && onSelect(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)}
              style={{
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                cursor: disabled ? "default" : "pointer",
                fontSize: ".85rem",
                fontWeight: selected || tdy ? 800 : 500,
                background: selected ? C.blue : tdy ? C.gray100 : "transparent",
                color: selected ? C.white : disabled ? C.gray200 : C.gray700,
                border: tdy && !selected ? `1px solid ${C.blue}` : "none",
                transition: "all .1s"
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}
