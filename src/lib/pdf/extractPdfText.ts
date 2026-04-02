import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  
  // Disable worker since we are running in Node.js serverless environments (like Vercel)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  });
  
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      // In pdfjs-dist, items have a 'str' property
      .filter((item: any) => "str" in item)
      .map((item: any) => item.str)
      .join(" ");
    pages.push(text);
  }

  return pages.join("\n");
}
