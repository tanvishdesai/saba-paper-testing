import { getDocumentProxy } from "unpdf";

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const textItems = (content.items as Array<{ str: string; hasEOL?: boolean }>).filter(
      (item) => "str" in item,
    );

    let pageText = "";
    for (const item of textItems) {
      pageText += item.str;
      if (item.hasEOL) {
        pageText += "\n";
      }
    }
    pages.push(pageText);
  }

  return pages.join("\n");
}
