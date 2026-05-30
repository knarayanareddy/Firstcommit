/**
 * Client-side file text extraction for various document formats.
 */

export interface ExtractionResult {
  text: string;
  metadata: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    pageCount?: number;
    format: string;
    extractionWarnings: string[];
  };
}

const TEXT_EXTENSIONS = new Set([
  "md", "mdx", "txt", "text", "log", "rst", "adoc", "asciidoc",
  "json", "yaml", "yml", "html", "htm", "csv",
]);

const MIME_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/csv": "csv",
  "text/html": "html",
  "text/markdown": "md",
  "text/plain": "txt",
  "application/json": "json",
  "application/x-yaml": "yaml",
  "text/yaml": "yaml",
};

function getExtension(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (ext) return ext;
  return MIME_MAP[file.type] || "txt";
}

function getFormat(ext: string): string {
  const formatMap: Record<string, string> = {
    pdf: "PDF",
    docx: "Word Document",
    xlsx: "Excel Spreadsheet",
    xls: "Excel Spreadsheet",
    csv: "CSV",
    pptx: "PowerPoint",
    md: "Markdown",
    mdx: "Markdown (MDX)",
    txt: "Plain Text",
    text: "Plain Text",
    log: "Log File",
    html: "HTML",
    htm: "HTML",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    rst: "reStructuredText",
    adoc: "AsciiDoc",
    asciidoc: "AsciiDoc",
  };
  return formatMap[ext] || "Text";
}

async function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

async function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

async function extractPDF(file: File): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const arrayBuffer = await readAsArrayBuffer(file);

  const pdfjsLib = await import("pdfjs-dist");
  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ")
      .trim();

    if (pageText.length < 20 && i <= 5) {
      warnings.push(`Page ${i}: Possible scanned content (low text extraction)`);
    }
    pages.push(`--- Page ${i} ---\n${pageText}`);
  }

  const text = pages.join("\n\n");
  if (text.replace(/--- Page \d+ ---/g, "").trim().length < 50) {
    warnings.push("This PDF appears to be scanned. Text extraction may be incomplete.");
  }

  return {
    text,
    metadata: {
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      pageCount: pdf.numPages,
      format: "PDF",
      extractionWarnings: warnings,
    },
  };
}

async function extractDOCX(file: File): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const arrayBuffer = await readAsArrayBuffer(file);

  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });

  if (result.messages?.length) {
    result.messages.forEach((msg: any) => {
      if (msg.type === "warning") warnings.push(msg.message);
    });
  }

  return {
    text: result.value,
    metadata: {
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      format: "Word Document",
      extractionWarnings: warnings,
    },
  };
}

async function extractXLSX(file: File): Promise<ExtractionResult> {
  const warnings: string[] = [];
  const arrayBuffer = await readAsArrayBuffer(file);

  const XLSX = await import("xlsx");
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = (XLSX.utils as any).sheet_to_json(sheet, { header: 1 }) as any[][];
    if (!jsonData.length) continue;

    const header = (jsonData[0] as any[]) || [];
    const headerRow = `| ${header.map((h: any) => String(h ?? "")).join(" | ")} |`;
    const separator = `| ${header.map(() => "---").join(" | ")} |`;
    const rows = jsonData.slice(1).map((row: any) =>
      `| ${header.map((_: any, idx: number) => String(row[idx] ?? "")).join(" | ")} |`
    );

    if (jsonData.length > 100) {
      warnings.push(`Sheet "${sheetName}": ${jsonData.length} rows (large dataset)`);
    }

    sheets.push(`## Sheet: ${sheetName}\n\n${headerRow}\n${separator}\n${rows.join("\n")}`);
  }

  return {
    text: sheets.join("\n\n"),
    metadata: {
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      format: getExtension(file) === "csv" ? "CSV" : "Excel Spreadsheet",
      extractionWarnings: warnings,
    },
  };
}

async function extractHTML(file: File): Promise<ExtractionResult> {
  const htmlContent = await readAsText(file);
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  // Remove unwanted elements
  const removeSelectors = ["script", "style", "nav", "footer", "aside", "noscript"];
  removeSelectors.forEach((sel) => {
    doc.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const main = doc.querySelector("main") || doc.querySelector("article") || doc.body;
  const text = main?.textContent?.trim() || "";

  return {
    text,
    metadata: {
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      format: "HTML",
      extractionWarnings: [],
    },
  };
}

async function extractTextFile(file: File): Promise<ExtractionResult> {
  const text = await readAsText(file);
  const ext = getExtension(file);
  const warnings: string[] = [];

  // Detect markdown front matter
  if ((ext === "md" || ext === "mdx") && text.startsWith("---")) {
    const endIdx = text.indexOf("---", 3);
    if (endIdx > 0) {
      warnings.push("Front matter detected and preserved");
    }
  }

  return {
    text,
    metadata: {
      originalName: file.name,
      mimeType: file.type || "text/plain",
      sizeBytes: file.size,
      format: getFormat(ext),
      extractionWarnings: warnings,
    },
  };
}

/**
 * Main entry point: detect file type and extract text.
 */
export async function extractText(file: File): Promise<ExtractionResult> {
  const ext = getExtension(file);

  if (ext === "pdf") return extractPDF(file);
  if (ext === "docx") return extractDOCX(file);
  if (ext === "xlsx" || ext === "xls") return extractXLSX(file);
  if (ext === "csv") return extractXLSX(file); // xlsx handles CSV too
  if (ext === "html" || ext === "htm") return extractHTML(file);

  // Text-based files
  if (TEXT_EXTENSIONS.has(ext)) return extractTextFile(file);

  // Fallback: try reading as text
  try {
    return await extractTextFile(file);
  } catch {
    throw new Error(`Unsupported file type: .${ext}`);
  }
}

/** Check if a file extension is supported */
export function isSupportedFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const supported = new Set([
    ...Array.from(TEXT_EXTENSIONS),
    "pdf", "docx", "xlsx", "xls", "pptx",
  ]);
  return supported.has(ext);
}

/** Get file type icon emoji */
export function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    pdf: "📕", docx: "📘", doc: "📘",
    md: "📗", mdx: "📗", txt: "📗", text: "📗", log: "📗",
    xlsx: "📊", xls: "📊", csv: "📊",
    pptx: "📙",
    html: "🌐", htm: "🌐",
    json: "📄", yaml: "📄", yml: "📄",
    rst: "📄", adoc: "📄", asciidoc: "📄",
  };
  return iconMap[ext] || "📄";
}

/** Supported file extensions for display */
export const SUPPORTED_FORMATS = [
  "PDF", "DOCX", "MD", "TXT", "CSV", "XLSX",
  "HTML", "JSON", "YAML", "RST", "AsciiDoc",
];

/** Max file size: 50MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
/** Max files at once */
export const MAX_FILES = 20;

/** Accepted MIME types for file input */
export const ACCEPTED_MIME_TYPES = [
  ".pdf", ".docx", ".md", ".mdx", ".txt", ".text", ".log",
  ".csv", ".xlsx", ".xls", ".pptx",
  ".html", ".htm", ".json", ".yaml", ".yml",
  ".rst", ".adoc", ".asciidoc",
].join(",");

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
