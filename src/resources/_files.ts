import { promises as fs } from 'fs';
import * as path from 'path';

/** Writes binary response data to `filePath`, creating parent directories as needed. */
export async function saveBuffer(data: Buffer, filePath: string): Promise<string> {
  const directory = path.dirname(filePath);
  if (directory) {
    await fs.mkdir(directory, { recursive: true });
  }
  await fs.writeFile(filePath, data);
  return filePath;
}
