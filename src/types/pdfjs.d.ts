declare module 'pdfjs-dist/legacy/build/pdf' {
    export * from 'pdfjs-dist';
    export const GlobalWorkerOptions: {
        workerSrc: string;
    };
    export function getDocument(src: any): {
        promise: Promise<import('pdfjs-dist').PDFDocumentProxy>;
    };
}
