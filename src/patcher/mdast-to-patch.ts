import { visit } from "unist-util-visit";
import type { Root, Image } from "mdast";
import { ImageData } from "../../remark-docx/src/transformer";
import { IPatch, PatchType } from "./from-docx";
// Asegúrate de importar desde el mismo lugar que from-docx.ts
import { FileChild as FromDocxFileChild } from "@file/file-child";
import { Paragraph, ParagraphChild, FileChild, ImageRun, TextRun } from "docx";

type MdastToPatchOptions = {
    imageResolver: (url: string) => Promise<ImageData>;
};

/**
 * Convierte un AST de Markdown a un objeto IPatch compatible con el patcher
 * @param ast - AST de Markdown
 * @param options - Opciones para la conversión
 * @returns Un objeto IPatch que puede ser utilizado con patchDocument
 */
export async function mdastToPatch(ast: Root, options: MdastToPatchOptions): Promise<IPatch> {
    // 1. Extraer y resolver las imágenes
    const imageList: Image[] = [];
    visit(ast as any, "image", (node: Image) => {
        imageList.push(node);
    });

    // 2. Resolver las imágenes
    const imageDataMap: { [url: string]: ImageData } = {};
    if (imageList.length > 0) {
        const imageDatas = await Promise.all(imageList.map(({ url }) => options.imageResolver(url)));

        imageList.forEach((img, i) => {
            imageDataMap[img.url] = imageDatas[i];
        });
    }

    // 3. Convertir el AST a elementos docx
    const docxElements = await astToDocxElements(ast, imageDataMap);

    // 4. Crear un IPatch con el tipo correcto
    return {
        type: PatchType.DOCUMENT,
        children: docxElements as unknown as readonly FromDocxFileChild[],
    };
}

/**
 * Convierte un AST de Markdown a elementos docx
 * @param ast - AST de Markdown o nodos hijos
 * @param imageDataMap - Mapa de URL de imágenes a datos de imagen
 * @returns Array de elementos compatibles con docx
 */
async function astToDocxElements(ast: Root, imageDataMap: { [url: string]: ImageData }): Promise<FileChild[]> {
    const result: FileChild[] = [];

    // Recorrer los nodos del AST y convertirlos a elementos docx
    for (const node of ast.children) {
        switch (node.type) {
            case "paragraph":
                const paragraphChildren: ParagraphChild[] = [];

                // Convertir cada hijo del párrafo
                for (const child of node.children) {
                    switch (child.type) {
                        case "text":
                            paragraphChildren.push(new TextRun({ text: child.value }));
                            break;

                        case "image":
                            const imageData = imageDataMap[child.url];
                            if (imageData) {
                                paragraphChildren.push(
                                    new ImageRun({
                                        data: imageData.image,
                                        transformation: {
                                            width: imageData.width,
                                            height: imageData.height,
                                        },
                                        type: "png", // O detectar el tipo según la URL o los datos de la imagen
                                    }),
                                );
                            }
                            break;

                        // Añadir más casos para otros tipos de nodos según sea necesario
                    }
                }

                result.push(new Paragraph({ children: paragraphChildren }));
                break;

            // Añadir casos para otros tipos de nodos a nivel de bloque según sea necesario
            // como headings, lists, etc.
        }
    }

    return result;
}
