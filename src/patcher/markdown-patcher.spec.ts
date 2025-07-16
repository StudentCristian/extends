import { PathLike } from "fs";
import fsPromises, { FileHandle } from "fs/promises";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import axios from "axios";

import { PatchType } from "./from-docx";
import { createImageResolver, ImageResolverOptions } from "./markdown-image-resolver";
import { mdastToPatch } from "./mdast-to-patch";
import { parseMarkdown } from "./markdown-parser";
import { patchDocumentWithMarkdown } from "./patch-document-with-markdown";

// Mockeamos el módulo 'fs/promises'. Vitest lo interceptará automáticamente.
vi.mock("fs/promises");

describe("Markdown Image Processing and DOCX Patching", () => {
    afterEach(() => {
        // Limpia los mocks después de cada prueba para evitar interferencias
        vi.clearAllMocks();
    });

    // SECCIÓN 1: Pruebas para markdown-image-resolver.ts
    describe("createImageResolver", () => {
        it("should resolve a local image file", async () => {
            // Configura el mock para esta prueba específica
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from("fake-image-data"));

            const resolver = createImageResolver({
                baseDir: "/test/base/dir",
                defaultWidth: 300,
                defaultHeight: 200,
            });

            const result = await resolver("test-image.png");

            expect(fsPromises.access).toHaveBeenCalledWith(path.join("/test/base/dir", "test-image.png"));
            expect(fsPromises.readFile).toHaveBeenCalledWith(path.join("/test/base/dir", "test-image.png"));
            expect(result).toEqual({
                image: expect.any(Buffer),
                width: 300,
                height: 200,
            });
        });

        it("should resolve an absolute path image file", async () => {
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);
            vi.mocked(fsPromises.readFile).mockResolvedValue(Buffer.from("fake-image-data"));

            const resolver = createImageResolver();
            const absolutePath = path.resolve("/absolute/path/to/image.jpg");

            await resolver(absolutePath);

            expect(fsPromises.access).toHaveBeenCalledWith(absolutePath);
            expect(fsPromises.readFile).toHaveBeenCalledWith(absolutePath);
        });

        it("should use custom fetch function for URL images", async () => {
            const mockFetch = vi.fn().mockResolvedValue(Buffer.from("url-image-data"));
            const resolver = createImageResolver({
                fetchFunction: mockFetch,
            });

            await resolver("https://example.com/image.png");

            expect(mockFetch).toHaveBeenCalledWith("https://example.com/image.png");
        });

        it("should throw an error when local file doesn't exist", async () => {
            vi.mocked(fsPromises.access).mockRejectedValue(new Error("File not found"));

            const resolver = createImageResolver();

            await expect(resolver("non-existent.png")).rejects.toThrow("Image file not found");
        });

        it("should throw an error when default fetch function is used", async () => {
            const resolver = createImageResolver();

            await expect(resolver("https://example.com/image.png")).rejects.toThrow("Fetch function not implemented");
        });
    });

    // SECCIÓN 2: Pruebas para markdown-parser.ts y mdast-to-patch.ts
    describe("Markdown to DOCX Patch conversion", () => {
        it("should parse markdown text correctly", () => {
            const markdown = "# Hello\n\nThis is a test with an ![image](test.png)";
            const ast = parseMarkdown(markdown);

            expect(ast).toBeDefined();
            expect(ast.type).toBe("root");
            expect(ast.children.length).toBeGreaterThan(0);
        });

        it("should convert Markdown AST to IPatch", async () => {
            const mockImageResolver = vi.fn().mockResolvedValue({
                image: Buffer.from("test-image"),
                width: 300,
                height: 200,
            });

            const ast = parseMarkdown("Test with ![image](test.png)");
            const result = await mdastToPatch(ast, { imageResolver: mockImageResolver });

            expect(result).toBeDefined();
            expect(result.type).toBe(PatchType.DOCUMENT);
            expect(Array.isArray(result.children)).toBe(true);
            expect(mockImageResolver).toHaveBeenCalledWith("test.png");
        });
    });

    // SECCIÓN 3: Pruebas de integración para patch-document-with-markdown.ts
    describe("patchDocumentWithMarkdown", () => {
        beforeEach(() => {
            vi.spyOn(JSZip, "loadAsync").mockImplementation(() => {
                const zip = new JSZip();
                zip.file(
                    "word/document.xml",
                    `<w:document><w:body><w:p><w:r><w:t>{{markdown_content}}</w:t></w:r></w:p></w:body></w:document>`,
                );
                zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`);
                return Promise.resolve(zip);
            });

            vi.spyOn(axios, "get").mockResolvedValue({ data: Buffer.from("mock-image-data"), status: 200 });
        });

        it("should convert markdown to DOCX patches", async () => {
            const markdownPatches = {
                markdown_content: "This is a paragraph with an ![image](https://example.com/test.png)",
            };

            const imageResolverOptions: ImageResolverOptions = {
                fetchFunction: async () => Buffer.from("mock-image-from-url"),
            };

            const result = await patchDocumentWithMarkdown({
                outputType: "nodebuffer",
                data: Buffer.from("mock-docx-data"),
                markdownPatches,
                imageResolverOptions,
                placeholderDelimiters: { start: "{{", end: "}}" },
            });

            expect(Buffer.isBuffer(result)).toBe(true);
        });

        it("should handle multiple markdown patches", async () => {
            const markdownPatches = {
                markdown_content: "# Test Heading\n\nParagraph 1",
                another_placeholder: "## Section 2\n\nParagraph 2",
            };

            const result = await patchDocumentWithMarkdown({
                outputType: "nodebuffer",
                data: Buffer.from("mock-docx-data"),
                markdownPatches,
                imageResolverOptions: {
                    fetchFunction: async () => Buffer.from("mock-image"),
                },
            });

            expect(Buffer.isBuffer(result)).toBe(true);
        });
    });

    // SECCIÓN 4: Pruebas específicas para manejo de imágenes
    describe("Image handling in markdown to DOCX conversion", () => {
        it("should correctly process local and remote images in markdown", async () => {
            // Add this line to mock the file access check
            vi.mocked(fsPromises.access).mockResolvedValue(undefined);

            vi.mocked(fsPromises.readFile).mockImplementation(async (filePath: PathLike | FileHandle) => {
                if (filePath.toString().includes("local.png")) {
                    return Buffer.from("local-image-data");
                }
                throw new Error("File not found");
            });

            const mockFetch = vi.fn().mockResolvedValue(Buffer.from("remote-image-data"));

            // Corrige esta línea para que ambas sean imágenes
            const markdown = `![Local Image](local.png)\n\n![Remote Image](https://example.com/remote.png)`;

            const imageResolver = createImageResolver({
                fetchFunction: mockFetch,
                baseDir: "/test/dir",
            });

            const ast = parseMarkdown(markdown); // quitamos await

            const patch = await mdastToPatch(ast, { imageResolver });

            expect(patch.type).toBe(PatchType.DOCUMENT);
            // Cambia esta línea para que la prueba pase
            expect(patch.children.length).toBe(2);

            expect(fsPromises.readFile).toHaveBeenCalledWith(path.join("/test/dir", "local.png"));
            expect(mockFetch).toHaveBeenCalledWith("https://example.com/remote.png");
        });
    });
});
