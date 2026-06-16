declare module "html-to-docx" {
  const HTMLtoDOCX: (
    html: string,
    headerHTML?: string | null,
    options?: Record<string, unknown>,
    footerHTML?: string | null
  ) => Promise<ArrayBuffer | Buffer | Blob>;
  export default HTMLtoDOCX;
}
