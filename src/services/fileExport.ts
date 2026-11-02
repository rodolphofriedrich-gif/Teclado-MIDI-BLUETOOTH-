import { Capacitor } from '@capacitor/core';

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

/**
 * Salva/compartilha um arquivo. No Android abre a folha de compartilhamento (Drive, e-mail, WhatsApp...);
 * no navegador dispara um download comum.
 */
export async function exportFile(options: {
  fileName: string;
  data: Uint8Array;
  mimeType: string;
  title?: string;
}): Promise<'shared' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const written = await Filesystem.writeFile({
      path: options.fileName,
      data: toBase64(options.data),
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: options.title ?? options.fileName,
      url: written.uri,
      dialogTitle: options.title ?? options.fileName,
    });
    return 'shared';
  }

  const blob = new Blob([options.data as BlobPart], { type: options.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
