import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root } from "mdast";

/**
 * Convierte texto Markdown a un AST (Abstract Syntax Tree)
 * @param markdown - Texto en formato Markdown
 * @returns Árbol de sintaxis abstracta (AST) de Markdown
 */
export function parseMarkdown(markdown: string): Root {
    const processor = unified().use(remarkParse).use(remarkGfm);

    // Cambiamos processSync por parse, que solo genera el AST
    const ast = processor.parse(markdown);
    return ast as Root;
}
