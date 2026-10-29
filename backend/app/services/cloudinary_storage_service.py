import logging
import uuid
import cloudinary
import cloudinary.uploader
from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudinaryStorageService:
    def __init__(self):
        self._configured = False
        self._configure()

    def _configure(self):
        if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                secure=True,
            )
            self._configured = True
        else:
            logger.warning("Cloudinary credentials not configured; remote storage will be disabled.")
            self._configured = False

    def is_configured(self) -> bool:
        return self._configured

    def upload_html_template(
        self,
        content: str | bytes,
        filename: str = "template.html",
        folder: str = "sitech-series/email-templates",
    ) -> dict:
        """
        Uploads HTML file to Cloudinary as a raw resource.
        Returns dict with `public_id`, `secure_url`, and `bytes`.
        """
        if not self._configured:
            # Re-attempt configuration in case env vars were set dynamically
            self._configure()

        if not self._configured:
            logger.info("Cloudinary not configured. Skipping remote upload.")
            return {
                "public_id": None,
                "secure_url": None,
                "bytes": len(content.encode("utf-8") if isinstance(content, str) else content),
            }

        if isinstance(content, str):
            content_bytes = content.encode("utf-8")
        else:
            content_bytes = content

        unique_suffix = uuid.uuid4().hex[:10]
        sanitized_prefix = "".join(c for c in filename.rsplit(".", 1)[0] if c.isalnum() or c in ("-", "_"))[:30] or "template"
        public_id = f"{folder}/{sanitized_prefix}_{unique_suffix}.html"

        try:
            result = cloudinary.uploader.upload(
                content_bytes,
                public_id=public_id,
                resource_type="raw",
                overwrite=True,
                invalidate=True,
            )
            return {
                "public_id": result.get("public_id"),
                "secure_url": result.get("secure_url"),
                "bytes": result.get("bytes", len(content_bytes)),
            }
        except Exception as e:
            logger.error(f"Failed to upload template to Cloudinary: {e}", exc_info=True)
            # Do not crash the entire application if Cloudinary upload fails; template will still be stored in DB
            return {
                "public_id": None,
                "secure_url": None,
                "bytes": len(content_bytes),
                "error": str(e),
            }

    def delete_html_template(self, public_id: str) -> bool:
        """
        Deletes a raw resource from Cloudinary by public_id.
        """
        if not self._configured or not public_id:
            return False

        try:
            result = cloudinary.uploader.destroy(public_id, resource_type="raw", invalidate=True)
            return result.get("result") in ("ok", "not found")
        except Exception as e:
            logger.error(f"Failed to delete Cloudinary asset {public_id}: {e}", exc_info=True)
            return False


cloudinary_storage_service = CloudinaryStorageService()
