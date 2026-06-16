export async function compressImage(
  file: File,
  maxPx = 800,
  quality = 0.75,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({
        base64: dataUrl.split(",")[1],
        mimeType: "image/jpeg",
      });
    };

    img.onerror = async () => {
      URL.revokeObjectURL(url);
      // Fallback for HEIC/HEIF files: try createImageBitmap which handles
      // formats that <img> cannot decode in some WKWebView contexts (iOS).
      try {
        const bitmap = await createImageBitmap(file);
        const { width, height } = bitmap;
        const scale = Math.min(1, maxPx / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          bitmap.close();
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve({
          base64: dataUrl.split(",")[1],
          mimeType: "image/jpeg",
        });
      } catch {
        reject(new Error("Image failed to load"));
      }
    };

    img.src = url;
  });
}
