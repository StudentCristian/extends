import { parseMarkdown } from "./markdown-parser";
import { mdastToPatch } from "./mdast-to-patch";
import { createImageResolver, ImageResolverOptions } from "./markdown-image-resolver";
import { patchDocument, PatchDocumentOutputType, InputDataType, IPatch } from "./from-docx";
import { OutputByType } from "@util/output-type";

export interface MarkdownPatchDocumentOptions<T extends PatchDocumentOutputType = PatchDocumentOutputType> {
    readonly outputType: T;
    readonly data: InputDataType;
    readonly markdownPatches: Readonly<Record<string, string>>;
    readonly imageResolverOptions?: ImageResolverOptions;
    readonly keepOriginalStyles?: boolean;
    readonly placeholderDelimiters?: Readonly<{
        readonly start: string;
        readonly end: string;
    }>;
    readonly recursive?: boolean;
}

/**
 * Aplica parches de Markdown a un documento DOCX
 * @param options - Opciones para el proceso de parcheo
 * @returns Un documento DOCX modificado
 */
export async function patchDocumentWithMarkdown<T extends PatchDocumentOutputType = PatchDocumentOutputType>({
    outputType,
    data,
    markdownPatches,
    imageResolverOptions = {},
    keepOriginalStyles = true,
    placeholderDelimiters = { start: "{{", end: "}}" },
    recursive = true,
}: MarkdownPatchDocumentOptions<T>): Promise<OutputByType[T]> {
    // Crear el resolvedor de imágenes
    const imageResolver = createImageResolver(imageResolverOptions);

    // Convertir cada contenido Markdown a un objeto IPatch
    const patchEntries = await Promise.all(
        Object.entries(markdownPatches).map(async ([key, markdownContent]) => {
            // 1. Parsear el Markdown a AST
            const ast = await parseMarkdown(markdownContent);

            // 2. Convertir el AST a un objeto IPatch
            const patch = await mdastToPatch(ast, { imageResolver });

            return [key, patch] as [string, IPatch];
        }),
    );

    // Construir el objeto patches para patchDocument
    const patches = Object.fromEntries(patchEntries);

    // Aplicar los parches al documento
    return patchDocument({
        outputType,
        data,
        patches,
        keepOriginalStyles,
        placeholderDelimiters,
        recursive,
    });
}
