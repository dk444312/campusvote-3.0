// src/utils/cropImageHelper.ts

// This utility function takes the cropped area coordinates 
// and returns the actual cropped image as a File object (Blob)

/**
 * @param {HTMLImageElement} image - The source image element
 * @param {PixelCrop} pixelCrop - Pixel-based crop area coordinates (from react-image-crop)
 * @returns {Promise<File>} A promise that resolves to the cropped image as a File (Blob).
 */
export async function getCroppedImage(
    image: HTMLImageElement,
    pixelCrop: any // Using 'any' here for simplicity, typically PixelCrop type from 'react-image-crop'
): Promise<File> {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Set canvas dimensions to the size of the cropped area
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    // Draw the cropped portion of the image onto the canvas
    ctx.drawImage(
        image,
        pixelCrop.x * scaleX,
        pixelCrop.y * scaleY,
        pixelCrop.width * scaleX,
        pixelCrop.height * scaleY,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // Get the cropped image as a Blob
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas is empty'));
                return;
            }
            // Create a File object from the Blob for easy uploading to Supabase
            const croppedFile = new File([blob], 'cropped-candidate.jpeg', {
                type: 'image/jpeg',
                lastModified: Date.now(),
            });
            resolve(croppedFile);
        }, 'image/jpeg', 0.95); // Use JPEG format with 95% quality
    });
}