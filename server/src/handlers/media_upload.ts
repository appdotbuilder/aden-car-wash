import { z } from 'zod';

export interface MediaUploadResult {
  url: string;
  filename: string;
  size: number;
  mime_type: string;
  compressed_size?: number;
  variants?: {
    thumbnail?: string;
    medium?: string;
  };
}

export interface UploadOptions {
  maxSize?: number; // in bytes, default 10MB
  allowedTypes?: string[]; // default: images and common formats
  compress?: boolean; // default true for images
  generateThumbnail?: boolean; // default true for images
}

// Validation schemas
const uploadOptionsSchema = z.object({
  maxSize: z.number().positive().optional().default(10 * 1024 * 1024), // 10MB
  allowedTypes: z.array(z.string()).optional().default([
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'text/csv'
  ]),
  compress: z.boolean().optional().default(true),
  generateThumbnail: z.boolean().optional().default(true)
});

const mediaUploadInputSchema = z.object({
  file: z.instanceof(Buffer),
  filename: z.string().min(1),
  mime_type: z.string().min(1),
  options: uploadOptionsSchema.optional()
});

type MediaUploadInput = z.infer<typeof mediaUploadInputSchema>;

// Simulated storage service
class StorageService {
  private static uploads = new Map<string, { buffer: Buffer; metadata: any }>();

  static async upload(
    buffer: Buffer,
    filename: string,
    metadata: any = {}
  ): Promise<string> {
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}-${filename}`;
    
    // Store in memory (in real implementation, upload to S3/Supabase)
    this.uploads.set(uniqueFilename, { buffer, metadata });
    
    // Return simulated public URL
    return `https://storage.example.com/uploads/${uniqueFilename}`;
  }

  static async delete(url: string): Promise<boolean> {
    const filename = url.split('/').pop();
    if (!filename) return false;
    
    const existed = this.uploads.has(filename);
    if (existed) {
      this.uploads.delete(filename);
    }
    return existed;
  }

  static async getFile(url: string): Promise<{ buffer: Buffer; metadata: any } | null> {
    const filename = url.split('/').pop();
    if (!filename) return null;
    
    return this.uploads.get(filename) || null;
  }

  // Helper method to clear storage for tests
  static clear(): void {
    this.uploads.clear();
  }

  // Helper method to get all files for variant cleanup
  static getAllFiles(): Map<string, { buffer: Buffer; metadata: any }> {
    return this.uploads;
  }
}

export async function uploadMedia(
  file: Buffer,
  filename: string,
  mime_type: string,
  options: UploadOptions = {}
): Promise<MediaUploadResult> {
  try {
    // Validate input
    const validatedInput = mediaUploadInputSchema.parse({
      file,
      filename,
      mime_type,
      options
    });

    const { file: validFile, filename: validFilename, mime_type: validMimeType, options: validOptions = {} } = validatedInput;
    
    // Apply defaults if needed
    const finalOptions = uploadOptionsSchema.parse(validOptions);

    // Check file size
    if (validFile.length > finalOptions.maxSize) {
      throw new Error(`File size ${validFile.length} exceeds maximum allowed size of ${finalOptions.maxSize} bytes`);
    }

    // Check file type
    if (!finalOptions.allowedTypes.includes(validMimeType)) {
      throw new Error(`File type ${validMimeType} is not allowed. Allowed types: ${finalOptions.allowedTypes.join(', ')}`);
    }

    // Validate filename
    const sanitizedFilename = sanitizeFilename(validFilename);
    if (!sanitizedFilename) {
      throw new Error('Invalid filename provided');
    }

    let processedBuffer = validFile;
    let compressedSize: number | undefined;
    const variants: { thumbnail?: string; medium?: string } = {};

    // Process image files
    if (validMimeType.startsWith('image/')) {
      if (finalOptions.compress) {
        processedBuffer = await compressImage(validFile, {
          quality: 85,
          maxWidth: 1920,
          maxHeight: 1080
        });
        compressedSize = processedBuffer.length;
      }

      // Generate thumbnail for images
      if (finalOptions.generateThumbnail) {
        const thumbnailBuffer = await compressImage(validFile, {
          quality: 80,
          width: 300,
          height: 300
        });

        const thumbnailFilename = `thumb_${sanitizedFilename}`;
        const thumbnailUrl = await StorageService.upload(
          thumbnailBuffer,
          thumbnailFilename,
          { type: 'thumbnail', originalFile: sanitizedFilename }
        );
        variants.thumbnail = thumbnailUrl;

        // Generate medium size variant
        const mediumBuffer = await compressImage(validFile, {
          quality: 85,
          width: 800,
          height: 600
        });

        const mediumFilename = `medium_${sanitizedFilename}`;
        const mediumUrl = await StorageService.upload(
          mediumBuffer,
          mediumFilename,
          { type: 'medium', originalFile: sanitizedFilename }
        );
        variants.medium = mediumUrl;
      }
    }

    // Upload main file
    const url = await StorageService.upload(
      processedBuffer,
      sanitizedFilename,
      {
        originalName: validFilename,
        mimeType: validMimeType,
        originalSize: validFile.length,
        compressedSize,
        uploadedAt: new Date().toISOString()
      }
    );

    const result: MediaUploadResult = {
      url,
      filename: sanitizedFilename,
      size: processedBuffer.length,
      mime_type: validMimeType,
      ...(compressedSize && { compressed_size: compressedSize }),
      ...(Object.keys(variants).length > 0 && { variants })
    };

    return result;

  } catch (error) {
    console.error('Media upload failed:', error);
    throw error;
  }
}

export async function deleteMedia(url: string): Promise<boolean> {
  try {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL provided');
    }

    // Validate URL format
    if (!url.includes('storage.example.com/uploads/')) {
      throw new Error('Invalid storage URL format');
    }

    // Get file metadata to check for variants
    const file = await StorageService.getFile(url);
    if (!file) {
      return false; // File doesn't exist
    }

    // Extract filename to check for and delete variants
    const filename = url.split('/').pop();
    let variantsDeleted = 0;
    
    if (filename) {
      // Parse the timestamped filename to get the original name
      // Format is: timestamp-originalname.ext
      const timestampMatch = filename.match(/^\d+-(.+)$/);
      const originalName = timestampMatch ? timestampMatch[1] : filename;
      
      // Delete thumbnail and medium variants if they exist
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      // Find actual variant URLs by checking stored files
      for (const [storedFilename, data] of StorageService.getAllFiles()) {
        if (storedFilename.includes(`thumb_${originalName}`) || 
            storedFilename.includes(`medium_${originalName}`)) {
          const variantUrl = `${baseUrl}${storedFilename}`;
          try {
            if (await StorageService.delete(variantUrl)) {
              variantsDeleted++;
            }
          } catch {}
        }
      }
    }

    // Delete main file
    const mainDeleted = await StorageService.delete(url);

    return mainDeleted;

  } catch (error) {
    console.error('Media deletion failed:', error);
    throw error;
  }
}

export async function compressImage(
  buffer: Buffer,
  options: { 
    quality?: number; 
    width?: number; 
    height?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {}
): Promise<Buffer> {
  try {
    const {
      quality = 85,
      width,
      height,
      maxWidth,
      maxHeight
    } = options;

    // Validate inputs
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error('Invalid image buffer provided');
    }

    if (quality < 1 || quality > 100) {
      throw new Error('Quality must be between 1 and 100');
    }

    // Simulate image compression
    // In a real implementation, you would use sharp or similar library:
    // 
    // import sharp from 'sharp';
    // 
    // let image = sharp(buffer);
    // 
    // if (width && height) {
    //   image = image.resize(width, height, { fit: 'cover' });
    // } else if (maxWidth || maxHeight) {
    //   image = image.resize(maxWidth, maxHeight, { 
    //     fit: 'inside',
    //     withoutEnlargement: true 
    //   });
    // }
    // 
    // return image
    //   .webp({ quality })
    //   .toBuffer();

    // For now, simulate compression by reducing buffer size
    let compressedSize = buffer.length;

    // Simulate different compression ratios based on quality
    const compressionRatio = quality / 100;
    compressedSize = Math.floor(buffer.length * compressionRatio);

    // Simulate size reduction from WebP conversion
    if (!width && !height) {
      compressedSize = Math.floor(compressedSize * 0.8); // WebP typically 20% smaller
    }

    // Apply dimension-based reduction
    if (width && height) {
      // Simulate resize compression
      compressedSize = Math.floor(compressedSize * 0.5);
    } else if (maxWidth || maxHeight) {
      // Simulate smart resize
      compressedSize = Math.floor(compressedSize * 0.7);
    }

    // Ensure minimum size
    compressedSize = Math.max(compressedSize, 100);

    // Create a new buffer with simulated compressed data
    const compressedBuffer = Buffer.alloc(compressedSize);
    buffer.copy(compressedBuffer, 0, 0, Math.min(buffer.length, compressedSize));

    return compressedBuffer;

  } catch (error) {
    console.error('Image compression failed:', error);
    throw error;
  }
}

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Trim whitespace first
  let sanitized = filename.trim();
  
  // If only whitespace, return empty
  if (!sanitized) {
    return '';
  }

  // Remove path traversal attempts and dangerous patterns
  sanitized = sanitized
    .replace(/\.\./g, '') // Remove .. path traversal
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*]/g, '_') // Replace Windows forbidden chars
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9.\-_]/g, '_') // Replace other special chars with underscore
    .toLowerCase() // Do lowercase before collapsing underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 255); // Limit length

  // Ensure we don't have an empty result after sanitization
  if (!sanitized) {
    sanitized = 'file';
  }

  return sanitized;
}

// Helper function to get file extension
function getFileExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }
  
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) {
    return filename.startsWith('.') && lastDot === 0 ? filename.substring(1).toLowerCase() : '';
  }
  
  return filename.substring(lastDot + 1).toLowerCase();
}

// Helper function to validate file extension against MIME type
function validateFileExtension(filename: string, mimeType: string): boolean {
  const extension = getFileExtension(filename);
  const mimeTypeMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'image/gif': ['gif'],
    'application/pdf': ['pdf'],
    'text/plain': ['txt'],
    'text/csv': ['csv']
  };

  const validExtensions = mimeTypeMap[mimeType];
  return validExtensions ? validExtensions.includes(extension) : false;
}

// Export utility functions for testing
export const utils = {
  sanitizeFilename,
  getFileExtension,
  validateFileExtension,
  StorageService // Export for test cleanup
};