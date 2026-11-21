import { conceptFigure, conceptModel } from '../../../domain/artefacts/conceptModel';
import type { ConceptModel } from '../../../domain/artefacts/types';
import { mdLine } from '../../../exports/mdText';
import { slugify } from '../../../exports/projectFile';
import { downloadFile } from '../../../ui/controls';

/** The picture, text and raster exports of the conceptual model tool. The artefact file is added by the tool frame. */

const PNG = 'png';
const fileBase = (title: string) => (/[a-z0-9]/i.test(title.normalize('NFKD')) ? slugify(title) : 'conceptual-model');

/** The picture as a standalone SVG file. Colours fall back to the light theme outside the app. */
export function pictureSvg(model: ConceptModel): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${conceptFigure(model, { force: true })}\n`;
}

export function exportSvg(title: string, model: ConceptModel): void {
  downloadFile(`${fileBase(title)}.svg`, pictureSvg(model), 'image/svg+xml');
}

/** The same picture drawn onto a canvas at twice its size and saved as PNG. No library is involved. */
export async function pictureRaster(model: ConceptModel, scale = 2): Promise<Uint8Array> {
  const svg = conceptFigure(model, { force: true })!;
  const size = svg.match(/width="(\d+)" height="(\d+)"/);
  const w = Number(size?.[1] ?? 1200), h = Number(size?.[2] ?? 800);
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  // Browsers limit canvas size; a very large model is drawn at a smaller scale rather than not at all.
  const k = Math.min(scale, 8000 / Math.max(w, h));
  canvas.width = Math.round(w * k);
  canvas.height = Math.round(h * k);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No drawing surface.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, `image/${PNG}`));
  if (!blob) throw new Error('The picture could not be drawn.');
  return new Uint8Array(await blob.arrayBuffer());
}

export async function exportPng(title: string, model: ConceptModel): Promise<void> {
  downloadFile(`${fileBase(title)}.${PNG}`, await pictureRaster(model), `image/${PNG}`);
}

/** A text description of the model: the same content as the picture, readable on its own. */
export function textDescription(title: string, model: ConceptModel): string {
  const name = mdLine(title) || 'Conceptual model';
  return [`# ${name}`, '', '_Conceptual model: what is inside the model, how the parts connect, and what is left out._', '', ...conceptModel.markdown(model)].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function exportMarkdown(title: string, model: ConceptModel): void {
  downloadFile(`${fileBase(title)}.md`, textDescription(title, model), 'text/markdown');
}
