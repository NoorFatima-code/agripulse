import jsPDF from "jspdf";
import { computeEstimate, CROPS, SOILS, type FarmInputs } from "./agronomy";

export function exportReport(input: FarmInputs) {
  const e = computeEstimate(input);
  const crop = CROPS[input.crop];
  const soil = SOILS[input.soil];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 60;

  // Header band
  doc.setFillColor(63, 132, 79);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Smart Irrigation Report", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 72);

  y = 130;
  doc.setTextColor(30, 40, 30);

  section("Field Summary");
  row("Crop", `${crop.emoji} ${crop.label}`);
  row("Soil", soil.label);
  row("Area", `${input.areaHa} ha`);
  row("Temperature", `${input.tempC} °C`);
  row("Humidity", `${input.humidity} %`);
  row("Rainfall (7d)", `${input.rainfallMm} mm`);
  row("Sunlight", `${input.sunlightHours} h/day`);

  y += 10;
  section("Water Recommendation");
  row("Reference ETo", `${e.etoMmDay} mm/day`);
  row("Crop ETc", `${e.etcMmDay} mm/day`);
  row("Net Irrigation", `${e.netIrrigationMmDay} mm/day`);
  row("Daily Volume (total)", `${e.dailyLitersTotal.toLocaleString()} L`);
  row("Weekly Volume (total)", `${e.weeklyLitersTotal.toLocaleString()} L`);
  row("Savings vs flood", `${e.waterSavingsPct} %`);

  y += 10;
  section("Yield Forecast");
  row("Yield per hectare", `${e.yieldTonsPerHa} t/ha`);
  row("Total expected yield", `${e.yieldTotalTons} tons`);
  row("Efficiency Score", `${e.efficiencyScore} / 100`);

  y = doc.internal.pageSize.getHeight() - 40;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Smart Irrigation & Crop Yield Estimator — Academic Demo", 40, y);

  doc.save(`irrigation-report-${crop.key}.pdf`);

  function section(title: string) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(63, 132, 79);
    doc.text(title, 40, y);
    doc.setDrawColor(220);
    doc.line(40, y + 4, W - 40, y + 4);
    y += 22;
    doc.setTextColor(30, 40, 30);
  }
  function row(k: string, v: string) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(110);
    doc.text(k, 50, y);
    doc.setTextColor(30, 40, 30);
    doc.setFont("helvetica", "bold");
    doc.text(v, W - 50, y, { align: "right" });
    y += 18;
  }
}
