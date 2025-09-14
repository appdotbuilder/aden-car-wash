import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { uploadMedia, deleteMedia, compressImage, utils, type MediaUploadResult } from '../handlers/media_upload';

// Test data
const createTestBuffer = (size: number = 1024): Buffer => {
  return Buffer.alloc(size, 'test data');
};

const createImageBuffer = (size: number = 2048): Buffer => {
  // Simulate a basic image file structure
  const buffer = Buffer.alloc(size);
  // Add some realistic image-like bytes
  buffer.writeUInt8(0xFF, 0); // JPEG magic number start
  buffer.writeUInt8(0xD8, 1);
  return buffer;
};

describe('uploadMedia', () => {
  beforeEach(() => {
    utils.StorageService.clear();
  });

  afterEach(() => {
    utils.StorageService.clear();
  });

  it('should upload an image file successfully', async () => {
    const buffer = createImageBuffer(5000);
    const filename = 'test-image.jpg';
    const mimeType = 'image/jpeg';

    const result = await uploadMedia(buffer, filename, mimeType);

    expect(result.url).toContain('storage.example.com/uploads/');
    expect(result.filename).toBe('test-image.jpg');
    expect(result.mime_type).toBe('image/jpeg');
    expect(result.size).toBeLessThanOrEqual(buffer.length);
    expect(result.compressed_size).toBeDefined();
    expect(result.variants).toBeDefined();
    expect(result.variants?.thumbnail).toContain('thumb_');
    expect(result.variants?.medium).toContain('medium_');
  });

  it('should upload non-image file without compression', async () => {
    const buffer = createTestBuffer(1000);
    const filename = 'document.pdf';
    const mimeType = 'application/pdf';

    const result = await uploadMedia(buffer, filename, mimeType, {
      compress: false,
      generateThumbnail: false
    });

    expect(result.url).toContain('storage.example.com/uploads/');
    expect(result.filename).toBe('document.pdf');
    expect(result.mime_type).toBe('application/pdf');
    expect(result.size).toBe(buffer.length);
    expect(result.compressed_size).toBeUndefined();
    expect(result.variants).toBeUndefined();
  });

  it('should reject files exceeding size limit', async () => {
    const largeBuffer = createTestBuffer(15 * 1024 * 1024); // 15MB
    const filename = 'large-file.jpg';
    const mimeType = 'image/jpeg';

    await expect(
      uploadMedia(largeBuffer, filename, mimeType, { maxSize: 10 * 1024 * 1024 })
    ).rejects.toThrow(/exceeds maximum allowed size/i);
  });

  it('should reject disallowed file types', async () => {
    const buffer = createTestBuffer(1000);
    const filename = 'script.js';
    const mimeType = 'application/javascript';

    await expect(
      uploadMedia(buffer, filename, mimeType)
    ).rejects.toThrow(/is not allowed/i);
  });

  it('should sanitize dangerous filenames', async () => {
    const buffer = createImageBuffer(1000);
    const dangerousFilename = '../../../etc/passwd.jpg';
    const mimeType = 'image/jpeg';

    const result = await uploadMedia(buffer, dangerousFilename, mimeType);

    expect(result.filename).not.toContain('../');
    expect(result.filename).toBe('etcpasswd.jpg');
  });

  it('should handle custom options correctly', async () => {
    const buffer = createImageBuffer(2000);
    const filename = 'custom-options.png';
    const mimeType = 'image/png';

    const result = await uploadMedia(buffer, filename, mimeType, {
      maxSize: 5000,
      allowedTypes: ['image/png'],
      compress: false,
      generateThumbnail: false
    });

    expect(result.compressed_size).toBeUndefined();
    expect(result.variants).toBeUndefined();
    expect(result.size).toBe(buffer.length);
  });

  it('should apply compression to images by default', async () => {
    const buffer = createImageBuffer(5000);
    const filename = 'compress-test.jpg';
    const mimeType = 'image/jpeg';

    const result = await uploadMedia(buffer, filename, mimeType);

    expect(result.compressed_size).toBeDefined();
    expect(result.compressed_size).toBeLessThan(buffer.length);
  });

  it('should reject invalid input parameters', async () => {
    await expect(
      uploadMedia(Buffer.alloc(0), 'test.jpg', 'image/jpeg')
    ).rejects.toThrow();

    await expect(
      uploadMedia(createImageBuffer(), '', 'image/jpeg')
    ).rejects.toThrow();

    await expect(
      uploadMedia(createImageBuffer(), 'test.jpg', '')
    ).rejects.toThrow();
  });

  it('should handle multiple file uploads independently', async () => {
    const buffer1 = createImageBuffer(1000);
    const buffer2 = createTestBuffer(800);
    
    const result1 = await uploadMedia(buffer1, 'image1.jpg', 'image/jpeg');
    const result2 = await uploadMedia(buffer2, 'document.pdf', 'application/pdf');

    expect(result1.url).not.toBe(result2.url);
    expect(result1.filename).toBe('image1.jpg');
    expect(result2.filename).toBe('document.pdf');
  });
});

describe('deleteMedia', () => {
  beforeEach(() => {
    utils.StorageService.clear();
  });

  afterEach(() => {
    utils.StorageService.clear();
  });

  it('should delete uploaded file successfully', async () => {
    // First upload a file
    const buffer = createImageBuffer(1000);
    const result = await uploadMedia(buffer, 'delete-test.jpg', 'image/jpeg');

    // Then delete it
    const deleted = await deleteMedia(result.url);

    expect(deleted).toBe(true);

    // Verify file is deleted by trying to get it
    const file = await utils.StorageService.getFile(result.url);
    expect(file).toBeNull();
  });

  it('should delete file variants when deleting main file', async () => {
    // Upload an image that generates variants
    const buffer = createImageBuffer(2000);
    const result = await uploadMedia(buffer, 'variants-test.jpg', 'image/jpeg');

    expect(result.variants?.thumbnail).toBeDefined();
    expect(result.variants?.medium).toBeDefined();

    // Delete main file
    const deleted = await deleteMedia(result.url);
    expect(deleted).toBe(true);

    // Verify variants are also deleted
    if (result.variants?.thumbnail) {
      const thumbnail = await utils.StorageService.getFile(result.variants.thumbnail);
      expect(thumbnail).toBeNull();
    }

    if (result.variants?.medium) {
      const medium = await utils.StorageService.getFile(result.variants.medium);
      expect(medium).toBeNull();
    }
  });

  it('should return false for non-existent files', async () => {
    const fakeUrl = 'https://storage.example.com/uploads/non-existent.jpg';
    
    const deleted = await deleteMedia(fakeUrl);

    expect(deleted).toBe(false);
  });

  it('should reject invalid URLs', async () => {
    await expect(deleteMedia('')).rejects.toThrow(/invalid url/i);
    await expect(deleteMedia('invalid-url')).rejects.toThrow(/invalid storage url format/i);
    await expect(deleteMedia('https://other-domain.com/file.jpg')).rejects.toThrow(/invalid storage url format/i);
  });

  it('should handle deletion errors gracefully', async () => {
    // Upload a file first
    const buffer = createTestBuffer(500);
    const result = await uploadMedia(buffer, 'error-test.pdf', 'application/pdf');

    // Delete should work normally
    const deleted = await deleteMedia(result.url);
    expect(deleted).toBe(true);

    // Second deletion should return false (file doesn't exist)
    const deletedAgain = await deleteMedia(result.url);
    expect(deletedAgain).toBe(false);
  });
});

describe('compressImage', () => {
  it('should compress image with quality setting', async () => {
    const buffer = createImageBuffer(5000);
    
    const compressed = await compressImage(buffer, { quality: 50 });

    expect(compressed.length).toBeLessThan(buffer.length);
    expect(Buffer.isBuffer(compressed)).toBe(true);
  });

  it('should resize image with specific dimensions', async () => {
    const buffer = createImageBuffer(10000);
    
    const resized = await compressImage(buffer, { 
      width: 300, 
      height: 300,
      quality: 80 
    });

    expect(resized.length).toBeLessThan(buffer.length);
    // Should be significantly smaller due to resize
    expect(resized.length).toBeLessThan(buffer.length * 0.6);
  });

  it('should compress with max dimensions', async () => {
    const buffer = createImageBuffer(8000);
    
    const compressed = await compressImage(buffer, { 
      maxWidth: 1920, 
      maxHeight: 1080,
      quality: 85 
    });

    expect(compressed.length).toBeLessThan(buffer.length);
  });

  it('should reject invalid quality values', async () => {
    const buffer = createImageBuffer(1000);

    await expect(compressImage(buffer, { quality: 0 })).rejects.toThrow(/quality must be between 1 and 100/i);
    await expect(compressImage(buffer, { quality: 101 })).rejects.toThrow(/quality must be between 1 and 100/i);
  });

  it('should reject invalid buffer input', async () => {
    await expect(compressImage(Buffer.alloc(0))).rejects.toThrow(/invalid image buffer/i);
    
    // @ts-ignore - Testing invalid input
    await expect(compressImage(null)).rejects.toThrow(/invalid image buffer/i);
  });

  it('should maintain minimum file size', async () => {
    const smallBuffer = createImageBuffer(50);
    
    const compressed = await compressImage(smallBuffer, { quality: 1 });

    // Should maintain at least 100 bytes minimum
    expect(compressed.length).toBeGreaterThanOrEqual(100);
  });

  it('should handle default quality setting', async () => {
    const buffer = createImageBuffer(2000);
    
    const compressed = await compressImage(buffer); // Uses default quality: 85

    expect(compressed.length).toBeLessThan(buffer.length);
    expect(compressed.length).toBeGreaterThan(100);
  });
});

describe('utility functions', () => {
  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      expect(utils.sanitizeFilename('../../../etc/passwd')).toBe('etcpasswd');
      
      // The input 'file<>:"|?*.txt' should become 'file______.txt'
      // because < > : " | ? * are all replaced with _ and then collapsed
      expect(utils.sanitizeFilename('file<>:"|?*.txt')).toBe('file_.txt');
      
      expect(utils.sanitizeFilename('normal-file_123.jpg')).toBe('normal-file_123.jpg');
    });

    it('should handle empty and invalid inputs', () => {
      expect(utils.sanitizeFilename('')).toBe('');
      expect(utils.sanitizeFilename('   ')).toBe('');
      // @ts-ignore - Testing invalid input
      expect(utils.sanitizeFilename(null)).toBe('');
      // @ts-ignore - Testing invalid input
      expect(utils.sanitizeFilename(undefined)).toBe('');
    });

    it('should convert to lowercase', () => {
      expect(utils.sanitizeFilename('MyFile.JPG')).toBe('myfile.jpg');
      expect(utils.sanitizeFilename('DOCUMENT.PDF')).toBe('document.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300);
      const sanitized = utils.sanitizeFilename(longName);
      expect(sanitized.length).toBeLessThanOrEqual(255);
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extensions correctly', () => {
      expect(utils.getFileExtension('file.jpg')).toBe('jpg');
      expect(utils.getFileExtension('document.PDF')).toBe('pdf');
      expect(utils.getFileExtension('archive.tar.gz')).toBe('gz');
      expect(utils.getFileExtension('no-extension')).toBe('');
      expect(utils.getFileExtension('.hidden')).toBe('hidden');
    });
  });

  describe('validateFileExtension', () => {
    it('should validate matching extensions and MIME types', () => {
      expect(utils.validateFileExtension('image.jpg', 'image/jpeg')).toBe(true);
      expect(utils.validateFileExtension('image.jpeg', 'image/jpeg')).toBe(true);
      expect(utils.validateFileExtension('image.png', 'image/png')).toBe(true);
      expect(utils.validateFileExtension('document.pdf', 'application/pdf')).toBe(true);
    });

    it('should reject mismatched extensions and MIME types', () => {
      expect(utils.validateFileExtension('image.jpg', 'image/png')).toBe(false);
      expect(utils.validateFileExtension('document.pdf', 'image/jpeg')).toBe(false);
      expect(utils.validateFileExtension('file.unknown', 'application/unknown')).toBe(false);
    });
  });
});

describe('edge cases and error handling', () => {
  beforeEach(() => {
    utils.StorageService.clear();
  });

  afterEach(() => {
    utils.StorageService.clear();
  });

  it('should handle concurrent uploads', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      uploadMedia(
        createImageBuffer(1000 + i * 100),
        `concurrent-${i}.jpg`,
        'image/jpeg'
      )
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(5);
    
    // All uploads should succeed with unique URLs
    const urls = results.map(r => r.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(5);
  });

  it('should handle special filename characters', async () => {
    const buffer = createTestBuffer(500);
    const specialNames = [
      'file with spaces.pdf',
      'file-with-dashes.pdf',
      'file_with_underscores.pdf',
      'file.with.dots.pdf'
    ];

    for (const filename of specialNames) {
      const result = await uploadMedia(buffer, filename, 'application/pdf');
      expect(result.filename).toBeTruthy();
      expect(result.url).toContain(result.filename);
    }
  });

  it('should preserve file metadata through upload process', async () => {
    const buffer = createImageBuffer(3000);
    const filename = 'metadata-test.png';
    const mimeType = 'image/png';

    const result = await uploadMedia(buffer, filename, mimeType);

    // Check that file can be retrieved with metadata
    const stored = await utils.StorageService.getFile(result.url);
    expect(stored).toBeTruthy();
    expect(stored?.metadata.originalName).toBe(filename);
    expect(stored?.metadata.mimeType).toBe(mimeType);
    expect(stored?.metadata.originalSize).toBe(buffer.length);
  });
});