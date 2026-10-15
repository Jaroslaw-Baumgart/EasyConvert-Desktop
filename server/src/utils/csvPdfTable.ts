import type { CsvRow } from "./csv";

export class CsvPdfTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvPdfTableError";
  }
}

type RenderCsvTableOptions = {
  doc: PDFKit.PDFDocument;
  headers: string[];
  rows: CsvRow[];
  regularFontPath: string;
  boldFontPath: string;
};

export async function renderCsvTable({
  doc,
  headers,
  rows,
  regularFontPath,
  boldFontPath,
}: RenderCsvTableOptions) {
  const margin = 36;
  const cellPadding = 6;
  const rowHeight = 24;
  const tableWidth = doc.page.width - margin * 2;
  const minFontSize = 5;
  const maxFontSize = 10;

  if (tableWidth / headers.length <= cellPadding * 2 + minFontSize * 2) {
    throw new CsvPdfTableError(
      "Too many CSV columns for this page. Choose A3 landscape.",
    );
  }

  let fontSize = minFontSize;
  for (
    let candidateSize = maxFontSize;
    candidateSize >= minFontSize;
    candidateSize -= 1
  ) {
    doc.font(regularFontPath).fontSize(candidateSize);
    const requiredTableWidth = headers.reduce(
      (totalWidth, header) => {
        const widestValue = rows.reduce(
          (width, row) =>
            Math.max(
              width,
              doc.widthOfString(row[header] ?? ""),
              doc.widthOfString(header),
            ),
          0,
        );

        return totalWidth + widestValue + cellPadding * 2;
      },
      0,
    );

    if (requiredTableWidth <= tableWidth) {
      fontSize = candidateSize;
      break;
    }
  }

  doc.font(regularFontPath).fontSize(fontSize);
  const minimumWidth = cellPadding * 2 + 20;
  const preferredWidths = headers.map((header) =>
    rows.reduce(
      (width, row) =>
        Math.max(
          width,
          doc.widthOfString(row[header] ?? "") + cellPadding * 2,
        ),
      Math.max(minimumWidth, doc.widthOfString(header) + cellPadding * 2),
    ),
  );
  const baseWidth = Math.min(minimumWidth, tableWidth / headers.length);
  const weight = preferredWidths.reduce((total, width) => total + width, 0);
  const columnWidths = preferredWidths.map(
    (width) =>
      baseWidth +
      ((tableWidth - baseWidth * headers.length) * width) / weight,
  );

  const getRowHeight = (values: string[]) => {
    const tallestContent = values.reduce(
      (height, value, index) =>
        Math.max(
          height,
          doc.heightOfString(value, {
            width: columnWidths[index] - cellPadding * 2,
          }),
        ),
      0,
    );

    return Math.max(rowHeight, tallestContent + cellPadding * 2);
  };

  const splitValueToFit = (
    value: string,
    columnWidth: number,
    maximumContentHeight: number,
  ) => {
    const contentWidth = columnWidth - cellPadding * 2;
    if (doc.heightOfString(value, { width: contentWidth }) <= maximumContentHeight) {
      return [value, ""] as const;
    }

    let low = 1;
    let high = value.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (doc.heightOfString(value.slice(0, middle), { width: contentWidth }) <= maximumContentHeight) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    const lastWhitespace = value.lastIndexOf(" ", low - 1);
    const splitAt = lastWhitespace > 0 ? lastWhitespace + 1 : low;
    return [value.slice(0, splitAt), value.slice(splitAt)] as const;
  };

  const drawCell = (
    value: string,
    x: number,
    y: number,
    height: number,
    columnWidth: number,
    isHeader = false,
  ) => {
    if (isHeader) {
      doc.rect(x, y, columnWidth, height).fill("#e8eef7");
    }
    doc
      .rect(x, y, columnWidth, height)
      .lineWidth(0.5)
      .strokeColor("#94a3b8")
      .stroke();
    doc.fillColor("#111827").text(value, x + cellPadding, y + cellPadding, {
      width: columnWidth - cellPadding * 2,
      height: height - cellPadding * 2,
    });
  };

  let y = margin;
  const drawHeaders = () => {
    doc.font(boldFontPath).fontSize(fontSize);
    const headerHeight = getRowHeight(headers);
    if (headerHeight > doc.page.height - margin * 2 - rowHeight) {
      throw new CsvPdfTableError("CSV headers are too tall for the selected page.");
    }

    let x = margin;
    headers.forEach((header, index) => {
      drawCell(header, x, y, headerHeight, columnWidths[index], true);
      x += columnWidths[index];
    });
    y += headerHeight;
    doc.font(regularFontPath).fontSize(fontSize).fillColor("#111827");
  };

  drawHeaders();
  for (const [rowIndex, row] of rows.entries()) {
    let remainingValues = headers.map((header) => row[header] ?? "");
    let firstSegment = true;

    while (firstSegment || remainingValues.some((value) => value.length > 0)) {
      firstSegment = false;
      const availableHeight = doc.page.height - margin - y;
      if (availableHeight <= rowHeight) {
        doc.addPage();
        y = margin;
        drawHeaders();
        continue;
      }

      const segments = remainingValues.map((value, index) =>
        splitValueToFit(value, columnWidths[index], availableHeight - cellPadding * 2),
      );
      const segmentValues = segments.map(([segment]) => segment);
      const nextValues = segments.map(([, rest]) => rest);
      const segmentHeight = getRowHeight(segmentValues);
      let x = margin;
      segmentValues.forEach((value, index) => {
        drawCell(value, x, y, segmentHeight, columnWidths[index]);
        x += columnWidths[index];
      });

      y += segmentHeight;
      remainingValues = nextValues;
      if (remainingValues.some((value) => value.length > 0)) {
        doc.addPage();
        y = margin;
        drawHeaders();
      }
    }

    if (rowIndex % 100 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }
}
