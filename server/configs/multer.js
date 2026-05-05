import multer from "multer";

// Serverless-friendly: avoid writing to disk. Cloudinary uploads should use in-memory buffers.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4,
  },
  fileFilter: (req, file, callback) => {
    if (file.mimetype?.startsWith("image/")) {
      return callback(null, true);
    }

    return callback(new Error("Only image files are allowed"));
  },
});
