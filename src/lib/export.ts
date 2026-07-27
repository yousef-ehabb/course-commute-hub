import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function exportToExcel(data: any[], filename: string, metadata?: string[][]) {
  let ws;
  if (metadata && metadata.length > 0) {
    ws = XLSX.utils.aoa_to_sheet(metadata);
    XLSX.utils.sheet_add_json(ws, data, { origin: -1 });
  } else {
    ws = XLSX.utils.json_to_sheet(data);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

  // Basic RTL configuration for the worksheet
  if (!ws["!cols"]) ws["!cols"] = [];

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
  pdf.save(`${filename}.pdf`);
}

export function exportToWhatsApp(text: string) {
  const encodedText = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encodedText}`, "_blank");
}
