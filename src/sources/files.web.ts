import * as DocumentPicker from 'expo-document-picker';

export async function pickSourceFile(): Promise<{ name: string; text: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  try {
    if (!asset.file) throw new Error('无法读取文件，请重新选择或粘贴内容。');
    return { name: asset.name, text: await asset.file.text() };
  } finally { URL.revokeObjectURL(asset.uri); }
}

export async function exportSourceFile(name: string, content: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
