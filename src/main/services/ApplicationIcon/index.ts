import path from 'node:path';
import { stat } from 'node:fs/promises';
import { nativeImage } from 'electron';
import { resolveExistingFile } from '@main/utils/FileSystem';
import type { ApplicationIconSelectionResult } from '@shared/contracts/domain';

const MAX_ICON_DIMENSION = 256;
const MAX_ICON_DATA_URL_LENGTH = 600_000;
const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;

export class ApplicationIconService {
  public async load(selectedPath: string): Promise<ApplicationIconSelectionResult> {
    const imagePath = await resolveExistingFile(selectedPath, ['.jpeg', '.jpg', '.png', '.webp']);
    if ((await stat(imagePath)).size > MAX_SOURCE_FILE_BYTES) {
      throw new Error('Choose an application icon smaller than 10 MB.');
    }
    const sourceImage = nativeImage.createFromPath(imagePath);
    if (sourceImage.isEmpty()) {
      throw new Error('The selected application icon could not be read as an image.');
    }
    const sourceSize = sourceImage.getSize();
    const scale = Math.min(1, MAX_ICON_DIMENSION / Math.max(sourceSize.width, sourceSize.height));
    const normalizedImage =
      scale < 1
        ? sourceImage.resize({
            height: Math.max(1, Math.round(sourceSize.height * scale)),
            quality: 'good',
            width: Math.max(1, Math.round(sourceSize.width * scale)),
          })
        : sourceImage;
    const dataUrl = normalizedImage.toDataURL();
    if (!dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > MAX_ICON_DATA_URL_LENGTH) {
      throw new Error('The selected application icon is too large to store safely.');
    }
    return { dataUrl, fileName: path.basename(imagePath), status: 'selected' };
  }
}
