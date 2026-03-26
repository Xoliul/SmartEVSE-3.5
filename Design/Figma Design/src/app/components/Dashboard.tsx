import { useState } from "react";
import { InfoDialog } from "./InfoDialog";
import { helpText } from "../config/helpText";
import EVIcon from "../../imports/EV_Icon.svg";
import GridIcon from "../../imports/Grid_Icon.svg";
import HouseIcon from "../../imports/House_Icon.svg";

interface DashboardProps {
  data: any;
  isDarkMode: boolean;
}

export function Dashboard({ data, isDarkMode }: DashboardProps) {
  const [selectedMode, setSelectedMode] = useState("Smart");
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [scheduleMode, setScheduleMode] = useState("Smart");

  // Normal mode slider
  const [normalCurrent, setNormalCurrent] = useState(16);

  // Smart mode override slider (0 means "none", otherwise 6-32)
  const [smartOverride, setSmartOverride] = useState(0);

  // Solar mode sliders
  const [solarStartCurrent, setSolarStartCurrent] =
    useState(10);
  const [solarMaxImport, setSolarMaxImport] = useState(6);
  const [solarStopTime, setSolarStopTime] = useState(10);

  const handleModeChange = (mode: string) => {
    setSelectedMode(mode);
    // In real implementation: POST /settings?mode=X
  };

  const handleSchedule = () => {
    // Handle schedule submission here
    console.log("Scheduled:", { scheduleDate, scheduleTime, scheduleMode });
    setShowScheduleDialog(false);
    // Reset form
    setScheduleDate("");
    setScheduleTime("");
    setScheduleMode("Smart");
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Stats and Energy Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Charging Stats Card */}
        <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl p-6 border border-[#2a3544] shadow-2xl">
          {/* Arc Gauge */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-full max-w-sm h-48">
              <svg
                viewBox="0 0 300 180"
                className="w-full h-full"
              >
                <defs>
                  {/* Gradient for the arc - from base color to lighter tint */}
                  <linearGradient
                    id="arcGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="50%" stopColor="#4A9EFF" />
                    <stop offset="100%" stopColor="#edf6ff" />
                  </linearGradient>
                </defs>
                {/* Background arc */}
                <path
                  d="M 30 160 A 120 120 0 0 1 270 160"
                  fill="none"
                  stroke="#2a3544"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                {/* Filled arc (based on current) */}
                <path
                  d="M 30 160 A 120 120 0 0 1 270 160"
                  fill="none"
                  stroke="url(#arcGradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(data.phase_currents.TOTAL / 10 / 32) * 377} 377`}
                  style={{
                    filter:
                      "drop-shadow(0 0 8px rgba(74, 158, 255, 0.6))",
                  }}
                />
                {/* CHARGING text */}
                <text
                  x="150"
                  y="100"
                  textAnchor="middle"
                  fill="#9CA3AF"
                  fontSize="16"
                  fontWeight="500"
                  letterSpacing="3"
                >
                  CHARGING
                </text>
                {/* Current value */}
                <text
                  x="150"
                  y="150"
                  textAnchor="middle"
                  fill="white"
                  fontSize="42"
                  fontWeight="bold"
                >
                  {(data.phase_currents.TOTAL / 10).toFixed(1)}
                </text>
                {/* Unit */}
                <text
                  x="205"
                  y="150"
                  textAnchor="start"
                  fill="#9CA3AF"
                  fontSize="22"
                  fontWeight="normal"
                >
                  A
                </text>
              </svg>
            </div>
          </div>

          {/* Per-phase currents */}
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 pl-4 border-l-2 border-[#2a3544]">
              <div className="text-center">
                <span className="text-xs text-gray-500 block mb-1">
                  L1
                </span>
                <span className="text-lg font-bold">
                  {(data.phase_currents.L1 / 10).toFixed(1)}
                  <span className="text-sm text-gray-400">
                    A
                  </span>
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 block mb-1">
                  L2
                </span>
                <span className="text-lg font-bold">
                  {(data.phase_currents.L2 / 10).toFixed(1)}
                  <span className="text-sm text-gray-400">
                    A
                  </span>
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-500 block mb-1">
                  L3
                </span>
                <span className="text-lg font-bold">
                  {(data.phase_currents.L3 / 10).toFixed(1)}
                  <span className="text-sm text-gray-400">
                    A
                  </span>
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-[#2a3544]">
              <span className="text-gray-400 text-sm">
                Power
              </span>
              <span className="text-2xl font-bold">
                {(
                  data.ev_meter.import_active_power / 1000
                ).toFixed(1)}{" "}
                <span className="text-lg text-gray-400">
                  kW
                </span>
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">
                Energy
              </span>
              <span className="text-2xl font-bold">
                {(data.ev_meter.charged_wh / 1000).toFixed(1)}{" "}
                <span className="text-lg text-gray-400">
                  kWh
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Energy Flow Diagram */}
        <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl p-8 border border-[#2a3544] shadow-2xl flex items-center justify-center">
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full justify-center">
            {/* Grid Mast Icon */}
            <div className="flex flex-col items-center gap-3">
              <img
                src={GridIcon}
                alt="Grid"
                width="100"
                height="100"
                className="flex-shrink-0 m-[0px]"
              />
              <span className="text-lg font-semibold">
                {(data.grid.power / 1000).toFixed(1)}{" "}
                <span className="text-sm text-gray-400">
                  kW
                </span>
              </span>
            </div>

            {/* Arrow Grid to House */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              className="flex-shrink-0"
            >
              {/* Horizontal arrow for desktop */}
              <path
                d="M0 16 L26 16 M20 10 L26 16 L20 22"
                stroke="#4A9EFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hidden sm:block"
              />
              {/* Vertical arrow for mobile */}
              <path
                d="M16 0 L16 26 M10 20 L16 26 L22 20"
                stroke="#4A9EFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="block sm:hidden"
              />
            </svg>

            {/* House Icon */}
            <div className="flex flex-col items-center gap-3">
              <img
                src={HouseIcon}
                alt="House"
                width="100"
                height="100"
                className="flex-shrink-0 m-[0px]"
              />
              <span className="text-lg font-semibold">
                {(data.home.power / 1000).toFixed(1)}{" "}
                <span className="text-sm text-gray-400">
                  kW
                </span>
              </span>
            </div>

            {/* Arrow House to EV */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              className="flex-shrink-0"
            >
              {/* Horizontal arrow for desktop */}
              <path
                d="M0 16 L26 16 M20 10 L26 16 L20 22"
                stroke="#4A9EFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="hidden sm:block"
              />
              {/* Vertical arrow for mobile */}
              <path
                d="M16 0 L16 26 M10 20 L16 26 L22 20"
                stroke="#4A9EFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="block sm:hidden"
              />
            </svg>

            {/* EV Icon */}
            <div className="flex flex-col items-center gap-3">
              <img
                src={EVIcon}
                alt="EV"
                width="100"
                height="100"
                className="flex-shrink-0 m-[0px]"
              />
              <span className="text-lg font-semibold">
                {(
                  data.ev_meter.import_active_power / 1000
                ).toFixed(1)}{" "}
                <span className="text-sm text-gray-400">
                  kW
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selection and Parameters */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl overflow-hidden">
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-white/10 to-white/5 px-6 py-4 border-b border-[#2a3544] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg text-white font-semibold">Charge Mode</h2>
            <InfoDialog
              title={helpText.chargeMode.title}
              description={helpText.chargeMode.description}
            />
          </div>
          <button
            onClick={() => setShowScheduleDialog(true)}
            className="w-10 h-10 bg-gradient-to-br from-[#1e2836] to-[#16202b] border border-[#2a3544] rounded-lg flex items-center justify-center hover:border-[#4A9EFF] hover:shadow-lg hover:shadow-blue-500/20 transition-all"
            title="Schedule mode change"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                fill="#4A9EFF"
                d="M19,4H18V2H16V4H8V2H6V4H5C3.89,4 3,4.9 3,6V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V6A2,2 0 0,0 19,4M19,20H5V10H19V20M19,8H5V6H19V8Z"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Mode Buttons */}
          <div className="grid grid-cols-2 sm:flex gap-3">
            {/* Off Mode */}
            <button
              onClick={() => setSelectedMode("Off")}
              className={`py-4 px-6 rounded-xl transition-all font-medium flex items-center justify-center gap-3 sm:flex-1 ${
                selectedMode === "Off"
                  ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                  : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
                ></path>
              </svg>
              <span>Off</span>
            </button>

            {/* Pause Mode */}
            <button
              onClick={() => setSelectedMode("Pause")}
              className={`py-4 px-6 rounded-xl transition-all font-medium flex items-center justify-center gap-3 sm:flex-1 ${
                selectedMode === "Pause"
                  ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                  : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M14,19H18V5H14M6,19H10V5H6V19Z"
                ></path>
              </svg>
              <span>Pause</span>
            </button>

            {/* Solar Mode */}
            <button
              onClick={() => setSelectedMode("Solar")}
              className={`py-4 px-6 rounded-xl transition-all font-medium flex items-center justify-center gap-3 sm:flex-1 col-span-2 sm:col-span-1 ${
                selectedMode === "Solar"
                  ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                  : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.34,17L5.11,13.21C5.25,14 5.53,14.76 5.94,15.5C6.36,16.22 6.9,16.84 7.5,17.35L3.34,17M20.65,7L18.88,10.79C18.74,10 18.47,9.24 18.06,8.5C17.64,7.78 17.1,7.16 16.5,6.65L20.65,7M20.65,17L16.5,17.35C17.1,16.84 17.64,16.22 18.06,15.5C18.47,14.76 18.74,14 18.88,13.21L20.65,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"
                ></path>
              </svg>
              <span>Solar</span>
            </button>

            {/* Smart Mode */}
            <button
              onClick={() => setSelectedMode("Smart")}
              className={`py-4 px-6 rounded-xl transition-all font-medium flex items-center justify-center gap-3 sm:flex-1 ${
                selectedMode === "Smart"
                  ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                  : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,6H13V12.41L17.29,16.71L15.88,18.12L11,13.24V6Z"
                ></path>
              </svg>
              <span>Smart</span>
            </button>

            {/* Normal Mode */}
            <button
              onClick={() => setSelectedMode("Normal")}
              className={`py-4 px-6 rounded-xl transition-all font-medium flex items-center justify-center gap-3 sm:flex-1 ${
                selectedMode === "Normal"
                  ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                  : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
              }`}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                className="flex-shrink-0"
              >
                <path
                  fill="currentColor"
                  d="M17.3 5C19 6.5 20 8.6 20 11C20 15.4 16.4 19 12 19S4 15.4 4 11C4 8.6 5.1 6.5 6.7 5H17.3M18 3H6L5.4 3.5C3.2 5.4 2 8.1 2 11C2 16.5 6.5 21 12 21S22 16.5 22 11C22 8.1 20.8 5.4 18.6 3.5L18 3M13 7.5C13 8.3 13.7 9 14.5 9S16 8.3 16 7.5 15.3 6 14.5 6 13 6.7 13 7.5M8 7.5C8 8.3 8.7 9 9.5 9S11 8.3 11 7.5 10.3 6 9.5 6 8 6.7 8 7.5M7 13C8.1 13 9 12.1 9 11C9 9.9 8.1 9 7 9S5 9.9 5 11C5 12.1 5.9 13 7 13M11.5 15C11.5 13.9 10.6 13 9.5 13S7.5 13.9 7.5 15C7.5 16.1 8.4 17 9.5 17S11.5 16.1 11.5 15M12 13C13.1 13 14 12.1 14 11C14 9.9 13.1 9 12 9S10 9.9 10 11C10 12.1 10.9 13 12 13M16.5 15C16.5 13.9 15.6 13 14.5 13S12.5 13.9 12.5 15C12.5 16.1 13.4 17 14.5 17S16.5 16.1 16.5 15M19 11C19 9.9 18.1 9 17 9S15 9.9 15 11C15 12.1 15.9 13 17 13S19 12.1 19 11"
                ></path>
              </svg>
              <span>Normal</span>
            </button>
          </div>

          {/* Solar Mode Parameters */}
          {selectedMode === "Solar" && (
            <div className="space-y-6 pt-4 border-t border-[#2a3544]">
              {/* Start Current */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm text-gray-400 font-medium">
                    Start Current
                  </h3>
                  <InfoDialog
                    title={helpText.solarStartCurrent.title}
                    description={
                      helpText.solarStartCurrent.description
                    }
                  />
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="range"
                      min="6"
                      max="16"
                      value={solarStartCurrent}
                      onChange={(e) =>
                        setSolarStartCurrent(
                          Number(e.target.value),
                        )
                      }
                      className="w-full h-2 bg-[#2a3544] rounded-full appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #4A9EFF 0%, #4A9EFF ${((solarStartCurrent - 6) / 10) * 100}%, #2a3544 ${((solarStartCurrent - 6) / 10) * 100}%, #2a3544 100%)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      6A
                    </span>
                    <span className="text-2xl font-bold">
                      {solarStartCurrent}{" "}
                      <span className="text-lg text-gray-400">
                        A
                      </span>
                    </span>
                    <span className="text-sm text-gray-500">
                      16A
                    </span>
                  </div>
                </div>
              </div>

              {/* Max Import */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm text-gray-400 font-medium">
                    Max Import
                  </h3>
                  <InfoDialog
                    title={helpText.solarMaxImport.title}
                    description={
                      helpText.solarMaxImport.description
                    }
                  />
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="range"
                      min="0"
                      max="16"
                      value={solarMaxImport}
                      onChange={(e) =>
                        setSolarMaxImport(Number(e.target.value))
                      }
                      className="w-full h-2 bg-[#2a3544] rounded-full appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #4A9EFF 0%, #4A9EFF ${(solarMaxImport / 16) * 100}%, #2a3544 ${(solarMaxImport / 16) * 100}%, #2a3544 100%)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      0A
                    </span>
                    <span className="text-2xl font-bold">
                      {solarMaxImport}{" "}
                      <span className="text-lg text-gray-400">
                        A
                      </span>
                    </span>
                    <span className="text-sm text-gray-500">
                      16A
                    </span>
                  </div>
                </div>
              </div>

              {/* Stop Time */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-sm text-gray-400 font-medium">
                    Stop Time
                  </h3>
                  <InfoDialog
                    title={helpText.solarStopTime.title}
                    description={
                      helpText.solarStopTime.description
                    }
                  />
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={solarStopTime}
                      onChange={(e) =>
                        setSolarStopTime(Number(e.target.value))
                      }
                      className="w-full h-2 bg-[#2a3544] rounded-full appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #4A9EFF 0%, #4A9EFF ${((solarStopTime - 1) / 59) * 100}%, #2a3544 ${((solarStopTime - 1) / 59) * 100}%, #2a3544 100%)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">
                      1 min
                    </span>
                    <span className="text-2xl font-bold">
                      {solarStopTime}{" "}
                      <span className="text-lg text-gray-400">
                        min
                      </span>
                    </span>
                    <span className="text-sm text-gray-500">
                      60 min
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Smart Mode Override */}
          {selectedMode === "Smart" && (
            <div className="space-y-6 pt-4 border-t border-[#2a3544]">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm text-gray-400 font-medium">
                  Override Current
                </h3>
                <InfoDialog
                  title={helpText.smartOverride.title}
                  description={helpText.smartOverride.description}
                />
              </div>
              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="range"
                    min="0"
                    max="32"
                    value={smartOverride}
                    onChange={(e) =>
                      setSmartOverride(Number(e.target.value))
                    }
                    className="w-full h-2 bg-[#2a3544] rounded-full appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #4A9EFF 0%, #4A9EFF ${(smartOverride / 32) * 100}%, #2a3544 ${(smartOverride / 32) * 100}%, #2a3544 100%)`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    None
                  </span>
                  <span className="text-3xl font-bold">
                    {smartOverride === 0 ? (
                      <span className="text-gray-400 text-xl">
                        None
                      </span>
                    ) : (
                      <>
                        {smartOverride < 6 ? 6 : smartOverride}{" "}
                        <span className="text-xl text-gray-400">
                          A
                        </span>
                      </>
                    )}
                  </span>
                  <span className="text-sm text-gray-500">
                    32A
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Normal Mode Current */}
          {selectedMode === "Normal" && (
            <div className="space-y-6 pt-4 border-t border-[#2a3544]">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm text-gray-400 font-medium">
                  Charge Current
                </h3>
                <InfoDialog
                  title={helpText.normalCurrent.title}
                  description={helpText.normalCurrent.description}
                />
              </div>
              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="range"
                    min="6"
                    max="32"
                    value={normalCurrent}
                    onChange={(e) =>
                      setNormalCurrent(Number(e.target.value))
                    }
                    className="w-full h-2 bg-[#2a3544] rounded-full appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #4A9EFF 0%, #4A9EFF ${((normalCurrent - 6) / 26) * 100}%, #2a3544 ${((normalCurrent - 6) / 26) * 100}%, #2a3544 100%)`,
                    }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    6A
                  </span>
                  <span className="text-3xl font-bold">
                    {normalCurrent}{" "}
                    <span className="text-xl text-gray-400">
                      A
                    </span>
                  </span>
                  <span className="text-sm text-gray-500">
                    32A
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info Bar */}
      <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-xl p-5 border border-[#2a3544] shadow-xl">
        <div className="flex flex-wrap justify-between items-center gap-4 text-sm">
          <div>
            <span className="text-gray-400">MQTT: </span>
            <span className="text-green-400 font-medium">
              Connected
            </span>
          </div>
          <div>
            <span className="text-gray-400">C2: </span>
            <span className="text-white font-medium">
              On (3P)
            </span>
          </div>
          <div>
            <span className="text-gray-400">Temperature: </span>
            <span className="text-white font-medium">
              {data.evse.temp}°C / {data.evse.temp_max}°C
            </span>
          </div>
          
          <div>
            <span className="text-gray-400">Version: </span>
            <span className="text-white font-medium">
              {data.version}
            </span>
          </div>
        </div>
      </div>

      {/* Schedule Dialog */}
      {showScheduleDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-[#1e2836] to-[#16202b] rounded-2xl border border-[#2a3544] shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Schedule Mode Change</h3>
            
            <div className="space-y-5">
              {/* Date Input */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                />
              </div>

              {/* Time Input */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-[#0f1924] border border-[#2a3544] rounded-lg px-4 py-2.5 text-white focus:border-[#4A9EFF] focus:outline-none transition-colors"
                />
              </div>

              {/* Mode Selector */}
              <div>
                <label className="block text-sm text-gray-400 mb-3">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Off Mode */}
                  <button
                    type="button"
                    onClick={() => setScheduleMode("Off")}
                    className={`py-3 px-4 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                      scheduleMode === "Off"
                        ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                        : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        fill="currentColor"
                        d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"
                      ></path>
                    </svg>
                    <span>Off</span>
                  </button>

                  {/* Pause Mode */}
                  <button
                    type="button"
                    onClick={() => setScheduleMode("Pause")}
                    className={`py-3 px-4 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                      scheduleMode === "Pause"
                        ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                        : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        fill="currentColor"
                        d="M14,19H18V5H14M6,19H10V5H6V19Z"
                      ></path>
                    </svg>
                    <span>Pause</span>
                  </button>

                  {/* Solar Mode */}
                  <button
                    type="button"
                    onClick={() => setScheduleMode("Solar")}
                    className={`py-3 px-4 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                      scheduleMode === "Solar"
                        ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                        : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        fill="currentColor"
                        d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.34,17L5.11,13.21C5.25,14 5.53,14.76 5.94,15.5C6.36,16.22 6.9,16.84 7.5,17.35L3.34,17M20.65,7L18.88,10.79C18.74,10 18.47,9.24 18.06,8.5C17.64,7.78 17.1,7.16 16.5,6.65L20.65,7M20.65,17L16.5,17.35C17.1,16.84 17.64,16.22 18.06,15.5C18.47,14.76 18.74,14 18.88,13.21L20.65,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"
                      ></path>
                    </svg>
                    <span>Solar</span>
                  </button>

                  {/* Smart Mode */}
                  <button
                    type="button"
                    onClick={() => setScheduleMode("Smart")}
                    className={`py-3 px-4 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 ${
                      scheduleMode === "Smart"
                        ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                        : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        fill="currentColor"
                        d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,6H13V12.41L17.29,16.71L15.88,18.12L11,13.24V6Z"
                      ></path>
                    </svg>
                    <span>Smart</span>
                  </button>

                  {/* Normal Mode */}
                  <button
                    type="button"
                    onClick={() => setScheduleMode("Normal")}
                    className={`py-3 px-4 rounded-lg transition-all text-sm font-medium flex items-center justify-center gap-2 col-span-2 ${
                      scheduleMode === "Normal"
                        ? "bg-gradient-to-b from-[#7FB8FF] to-[#4A9EFF] text-white shadow-lg shadow-blue-500/30"
                        : "bg-gradient-to-br from-[#1e2836] to-[#16202b] text-gray-400 hover:text-white border border-[#2a3544]"
                    }`}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="flex-shrink-0"
                    >
                      <path
                        fill="currentColor"
                        d="M17.3 5C19 6.5 20 8.6 20 11C20 15.4 16.4 19 12 19S4 15.4 4 11C4 8.6 5.1 6.5 6.7 5H17.3M18 3H6L5.4 3.5C3.2 5.4 2 8.1 2 11C2 16.5 6.5 21 12 21S22 16.5 22 11C22 8.1 20.8 5.4 18.6 3.5L18 3M13 7.5C13 8.3 13.7 9 14.5 9S16 8.3 16 7.5 15.3 6 14.5 6 13 6.7 13 7.5M8 7.5C8 8.3 8.7 9 9.5 9S11 8.3 11 7.5 10.3 6 9.5 6 8 6.7 8 7.5M7 13C8.1 13 9 12.1 9 11C9 9.9 8.1 9 7 9S5 9.9 5 11C5 12.1 5.9 13 7 13M11.5 15C11.5 13.9 10.6 13 9.5 13S7.5 13.9 7.5 15C7.5 16.1 8.4 17 9.5 17S11.5 16.1 11.5 15M12 13C13.1 13 14 12.1 14 11C14 9.9 13.1 9 12 9S10 9.9 10 11C10 12.1 10.9 13 12 13M16.5 15C16.5 13.9 15.6 13 14.5 13S12.5 13.9 12.5 15C12.5 16.1 13.4 17 14.5 17S16.5 16.1 16.5 15M19 11C19 9.9 18.1 9 17 9S15 9.9 15 11C15 12.1 15.9 13 17 13S19 12.1 19 11"
                      ></path>
                    </svg>
                    <span>Normal</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => {
                  setShowScheduleDialog(false);
                  setScheduleDate("");
                  setScheduleTime("");
                  setScheduleMode("Smart");
                }}
                className="px-4 py-2.5 bg-[#0f1924] border border-[#2a3544] text-gray-400 rounded-lg hover:text-white transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                className="px-4 py-2.5 bg-gradient-to-r from-[#4A9EFF] to-[#3A8EEF] text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/30 transition-all font-medium"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}