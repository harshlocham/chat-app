"use client";

import { useState } from "react";
import {
    ImageKitAbortError,
    ImageKitInvalidRequestError,
    ImageKitServerError,
    ImageKitUploadNetworkError,
    upload,
} from "@imagekit/next";
import { Button } from "../ui/button";
import { ImageIcon } from "lucide-react";
import { getImageKitUploadAuth } from "@/lib/utils/imagekit";

interface ImageUploadProps {
    onSuccess: (res: { url?: string; fileId?: string }) => void;
    onProgress?: (progress: number) => void;
    className?: string;
    disabled?: boolean;
}

export const ImageUpload = ({ onSuccess, onProgress, className, disabled }: ImageUploadProps) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith("image/")) {
            setError("Please upload a valid image file.");
            return;
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            setError("File size must be less than 10MB.");
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const auth = await getImageKitUploadAuth();

            const res = await upload({
                file,
                fileName: `chat-${Date.now()}-${file.name}`,
                publicKey: auth.publicKey,
                signature: auth.signature,
                expire: auth.expire,
                token: auth.token,
                onProgress: (event) => {
                    const percent = (event.loaded / event.total) * 100;
                    if (onProgress) onProgress(Math.round(percent));
                },
            });

            onSuccess(res);
            e.target.value = ""; // reset input
        } catch (error) {
            if (error instanceof ImageKitAbortError) {
                setError("Upload aborted");
            } else if (
                error instanceof ImageKitInvalidRequestError ||
                error instanceof ImageKitUploadNetworkError ||
                error instanceof ImageKitServerError
            ) {
                setError(error.message);
            } else if (error instanceof Error) {
                setError(error.message);
            } else {
                setError("Unexpected error during upload");
            }
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className={className}>
            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                id="image-upload"
                hidden
                disabled={disabled || uploading}
            />
            <label htmlFor="image-upload">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled || uploading}
                    className="cursor-pointer"
                    asChild
                >
                    <span>
                        <ImageIcon size={16} className="mr-2" />
                        {uploading ? "Uploading..." : "Upload Image"}
                    </span>
                </Button>
            </label>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
    );
};
