import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
    disableAutoFetch: true,
    useWorkerFetch: false,
  });
  
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const textItems = content.items.filter((item: any) => "str" in item);

    let pageText = "";
    for (const item of textItems as any[]) {
      pageText += item.str;
      if (item.hasEOL) {
        pageText += "\n";
      }
    }
    pages.push(pageText);
  }

  return pages.join("\n");
}
