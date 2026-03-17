"use client";

import { useState } from "react";
import {
    ImageKitAbortError,
    ImageKitInvalidRequestError,
    ImageKitServerError,
    ImageKitUploadNetworkError,
    upload,
} from "@imagekit/next";
import { getImageKitUploadAuth } from "@/lib/utils/imagekit";

interface FileUploadProps {
    onSuccess: (res: { url?: string; fileId?: string }) => void;
    onProgress?: (progress: number) => void;
    fileType?: "image";
}

export const FileUpload = ({ onSuccess, onProgress, fileType }: FileUploadProps) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [progress, setProgress] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const validateFile = (file: File): boolean => {
        if (fileType === "image" && !file.type.startsWith("image/")) {
            setError("Please upload a valid video file.");
            return false;
        }
        if (file.size > 100 * 1024 * 1024) {
            setError("File size must be less than 100MB.");
            return false;
        }
        return true;
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !validateFile(file)) return;

        setUploading(true);
        setError(null);

        try {
            const auth = await getImageKitUploadAuth();

            const res = await upload({
                file,
                fileName: file.name,
                publicKey: auth.publicKey,
                signature: auth.signature,
                expire: auth.expire,
                token: auth.token,
                onProgress: (event) => {
                    const percent = (event.loaded / event.total) * 100;
                    setProgress(percent);
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
        <>
            <input
                type="file"
                accept={fileType === "image" ? "video/*" : "video/*"}
                onChange={handleFileChange}
                hidden
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </>
    );
};
