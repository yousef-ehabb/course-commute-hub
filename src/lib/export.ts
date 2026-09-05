import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function exportToExcel(data: any[], filename: string, metadata?: string[][]) {
  let ws: XLSX.WorkSheet;
  if (metadata && metadata.length > 0) {
    ws = XLSX.utils.aoa_to_sheet(metadata);
    XLSX.utils.sheet_add_json(ws, data, { origin: -1 });
  } else {
    ws = XLSX.utils.json_to_sheet(data);
  }

  // Calculate and apply generous column widths for clarity
  if (data && data.length > 0) {
    const keys = Object.keys(data[0]);
    ws["!cols"] = keys.map((key) => {
      let maxLen = key.length;
      for (const row of data) {
        const val = row[key];
        if (val !== undefined && val !== null) {
          const str = String(val);
          if (str.length > maxLen) maxLen = str.length;
        }
      }
      return { wch: Math.max(maxLen + 4, 14) };
    });
  } else if (!ws["!cols"]) {
    ws["!cols"] = [];
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

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
