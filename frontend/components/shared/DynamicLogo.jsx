import React, { useState, useEffect } from "react";

/**
 * DynamicLogo Component
 * A fully responsive, transparent logo featuring a running ECG heartbeat and live clock.
 */
const DynamicLogo = ({ width, height, className = "" }) => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  const secAngle = (seconds / 60) * 360;
  const minAngle = ((minutes + seconds / 60) / 60) * 360;
  const hourAngle = ((hours + minutes / 60) / 12) * 360;

  const clockCenter = { x: 613, y: 92 };

  // If a fixed width or height is provided, we skip the internal responsiveness
  const isFixed = width || height;

  return (
    <div
      className={`dynamic-logo-wrapper ${className}`}
      style={{
        width: isFixed ? width || "auto" : "100%",
        height: isFixed ? height || "auto" : "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <style>
        {`
          .dynamic-logo-svg-responsive {
            width: 100%;
            height: auto;
            display: block;
            overflow: visible;
            max-width: 100%;
          }

          /* Breakpoints for auto-responsiveness */
          @media (min-width: 301px) {
            .dynamic-logo-svg-responsive { width: 250px; }
          }
          @media (min-width: 440px) {
            .dynamic-logo-svg-responsive { width: 320px; }
          }
          @media (min-width: 769px) {
            .dynamic-logo-svg-responsive { width: 450px; }
          }
          @media (min-width: 1025px) {
            .dynamic-logo-svg-responsive { width: 600px; }
          }

          /* Ultra-small screen adjustment for Navbar/Fixed logos */
          @media (max-width: 300px) {
            .dynamic-logo-wrapper {
              width: 130px !important;
            }
          }

          @media (max-width: 241px) {
            .dynamic-logo-wrapper {
              width: 110px !important;
            }
          }
        `}
      </style>

      <svg
        viewBox="60 0 780 215"
        xmlns="http://www.w3.org/2000/svg"
        className={isFixed ? "" : "dynamic-logo-svg-responsive"}
        style={{
          width: isFixed ? "100%" : undefined,
          height: isFixed ? "100%" : undefined,
          display: "block",
          overflow: "visible",
        }}
      >
        <defs>
          <linearGradient id="heartbeatGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="20%" stopColor="white" stopOpacity="1" />
            <stop offset="40%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id="heartbeatMaskLogo">
            <rect x="0" y="0" width="1000" height="215" fill="url(#heartbeatGradient)">
              <animate
                attributeName="x"
                from="-500"
                to="900"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </rect>
          </mask>
        </defs>

        {/* Faint Background Trace */}
        <path
          d="M 60 92 H 840"
          stroke="#ed1c24"
          strokeWidth="1"
          strokeOpacity="0"
          fill="none"
        />

        {/* Animated ECG Trace */}
        <g mask="url(#heartbeatMaskLogo)">
          <path
            d="M 60 92 
               L 155 92 
               L 160 75 
               L 165 110 
               L 173 25 
               L 183 160 
               L 190 92 
               L 710 92 
               L 715 75 
               L 720 110 
               L 728 25 
               L 738 160 
               L 745 92 
               L 840 92"
            fill="none"
            stroke="#ed1c24"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Brand Typography */}
        <text
          x="450"
          y="135"
          textAnchor="middle"
          style={{
            fontFamily:
              "'Poppins', 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: "115px",
            fontWeight: "900",
            letterSpacing: "-3px",
          }}
        >
          <tspan fill="#10b981">Tym</tspan>
          <tspan fill="#ed1c24">4</tspan>
          <tspan fill="#10b981">D</tspan>
          <tspan fill="transparent">O</tspan>
          <tspan fill="#10b981">C</tspan>
        </text>

        {/* Live Clock Element */}
        <g transform={`translate(${clockCenter.x}, ${clockCenter.y})`}>
          <circle
            cx="0"
            cy="0"
            r="48"
            fill="none"
            stroke="#00bff3"
            strokeWidth="5"
          />
          {[...Array(12)].map((_, i) => (
            <line
              key={i}
              x1="0"
              y1="-38"
              x2="0"
              y2="-44"
              stroke="#00bff3"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${i * 30})`}
            />
          ))}

          <line
            y1="4"
            y2="-25"
            stroke="#00bff3"
            strokeWidth="8"
            strokeLinecap="round"
            transform={`rotate(${hourAngle})`}
          />
          <line
            y1="4"
            y2="-38"
            stroke="#00bff3"
            strokeWidth="5"
            strokeLinecap="round"
            transform={`rotate(${minAngle})`}
          />
          <line
            y1="10"
            y2="-42"
            stroke="#ed1c24"
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${secAngle})`}
          />
          <circle cx="0" cy="0" r="5" fill="#00bff3" />
        </g>
      </svg>
    </div>
  );
};

export default DynamicLogo;






