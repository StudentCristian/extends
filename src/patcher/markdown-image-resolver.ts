import { ImageData } from "../../remark-docx/src/transformer";
import { access, readFile } from "fs/promises";
import * as path from "path";

/**
 * Opciones para la resolución de imágenes
 */
export interface ImageResolverOptions {
    /** Directorio base para resolver rutas relativas */
    baseDir?: string;
    /** Función personalizada para obtener datos de imágenes de URLs */
    fetchFunction?: (url: string) => Promise<Buffer>;
    /** Ancho por defecto para imágenes (en px) */
    defaultWidth?: number;
    /** Alto por defecto para imágenes (en px) */
    defaultHeight?: number;
}

/**
 * Crea un resolvedor de imágenes para usar con el parser de Markdown
 */
export function createImageResolver(options: ImageResolverOptions = {}) {
    const { baseDir = process.cwd(), fetchFunction = defaultFetchFunction, defaultWidth = 600, defaultHeight = 400 } = options;

    return async function resolveImage(url: string): Promise<ImageData> {
        let imageBuffer: Buffer;

        if (isUrl(url)) {
            // Es una URL remota
            imageBuffer = await fetchFunction(url);
        } else {
            // Es una ruta de archivo local
            const filePath = path.isAbsolute(url) ? url : path.join(baseDir, url);

            try {
                // Verificar si el archivo existe usando access
                await access(filePath);
                imageBuffer = await readFile(filePath);
            } catch (error) {
                throw new Error(`Image file not found: ${filePath}`);
            }
        }

        // Aquí podrías añadir lógica para obtener las dimensiones reales de la imagen
        // Por ahora usamos valores predeterminados
        return {
            image: imageBuffer,
            width: defaultWidth,
            height: defaultHeight,
        };
    };
}

/**
 * Verifica si una cadena es una URL válida
 */
function isUrl(str: string): boolean {
    try {
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Función por defecto para obtener imágenes de URLs
 * En un entorno real, usarías fetch o axios
 */
async function defaultFetchFunction(url: string): Promise<Buffer> {
    throw new Error("Fetch function not implemented. Please provide your own fetch function.");
}
