import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import { patchDocumentWithMarkdown } from "../src/patcher/patch-document-with-markdown.js";
import { fileURLToPath } from "url";

// En Módulos ES (`"type": "module"`), `__dirname` no está disponible globalmente.
// Necesitamos calcularlo a partir de `import.meta.url`.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Descarga los datos de una imagen desde una URL.
 * @param url La URL de la imagen a descargar.
 * @returns Un Buffer con los datos de la imagen.
 */
async function fetchImage(url: string): Promise<Buffer> {
    console.log(`Descargando imagen desde: ${url}`);
    const response = await axios.get(url, { responseType: "arraybuffer" });
    return Buffer.from(response.data);
}

/**
 * Función principal que ejecuta el ejemplo de parcheo con imágenes.
 */
async function runImageDemo() {
    try {
        // 1. Definir la ruta a la plantilla y al archivo de salida.
        const templatePath = path.resolve(__dirname, "simple-template.docx");
        const outputPath = path.resolve(__dirname, "output-markdown-images-demo.docx");

        // Verificar que la plantilla exista antes de continuar.
        if (!fs.existsSync(templatePath)) {
            console.error(`Error: No se encontró la plantilla en: ${templatePath}`);
            console.log("Por favor, asegúrate de que el archivo 'simple-template.docx' exista en el directorio 'example'.");
            return;
        }

        console.log("Cargando plantilla...");
        const docxContent = fs.readFileSync(templatePath);

        // 2. Definir el contenido Markdown con las imágenes en línea.
        // Se insertarán dos imágenes, una después de la otra.
        const markdownContent = `![Logo Documentero](https://documentero.com/custom/landing4.png)
![Célula Eucariota](https://cdn.todamateria.com/imagenes/ce-lula-eucariota.jpg) ![Logo Documentero](https://i.pinimg.com/originals/39/e3/ea/39e3ea97c2e58b7d00bad7683007ce2b.jpg)`;

        const markdownPatches = {
            imagenes: markdownContent,
        };

        // 3. Configurar el resolvedor de imágenes para que use nuestra función de descarga.
        const imageResolverOptions = {
            fetchFunction: fetchImage,
            defaultWidth: 500, // Ancho por defecto si no se puede determinar
            defaultHeight: 350, // Alto por defecto
        };

        console.log("Aplicando parches de Markdown al documento...");

        // 4. Llamar a la función principal para aplicar los parches.
        const result = await patchDocumentWithMarkdown({
            outputType: "nodebuffer",
            data: docxContent,
            markdownPatches,
            imageResolverOptions,
            placeholderDelimiters: { start: "{{", end: "}}" },
        });

        // 5. Guardar el documento resultante en el disco.
        fs.writeFileSync(outputPath, result);

        console.log(`¡Éxito! El documento ha sido guardado en: ${outputPath}`);
    } catch (error) {
        console.error("Ocurrió un error al procesar el documento:", error);
    }
}

// Ejecutar el ejemplo.
runImageDemo().catch(console.error);
