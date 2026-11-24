export const MAX_IMAGE_FILE_BYTES = 800 * 1024;
export const MAX_TASK_FIELD_PHOTOS = 3;

export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error(`${file.name} is not an image.`));
      return;
    }
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      reject(new Error(`${file.name} exceeds the 800 KB upload limit.`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read image."));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}
