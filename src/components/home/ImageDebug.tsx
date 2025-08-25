"use client";

import { useState } from "react";
import { Image } from "@imagekit/next";
import { Button } from "../ui/button";
import { ImageUpload } from "./ImageUpload";

export const ImageDebug = () => {
    const [testImageUrl, setTestImageUrl] = useState<string>("");
    const [debugInfo, setDebugInfo] = useState<string>("");

    const handleImageUpload = (result: { url?: string; fileId?: string }) => {
        if (result.url) {
            setTestImageUrl(result.url);
            setDebugInfo(`Image uploaded successfully! URL: ${result.url}`);
        }
    };

    const testImageDisplay = () => {
        if (!testImageUrl) {
            setDebugInfo("No test image URL available");
            return;
        }

        setDebugInfo(`Testing image display with URL: ${testImageUrl}`);
    };

    return (
        <div className="p-4 border rounded-lg bg-background">
            <h3 className="text-lg font-medium mb-4">Image Debug Tool</h3>

            <div className="space-y-4">
                <div>
                    <h4 className="font-medium mb-2">Environment Variables:</h4>
                    <div className="text-sm space-y-1">
                        <p>NEXT_PUBLIC_URI_ENDPOINT: {process.env.NEXT_PUBLIC_URI_ENDPOINT || "Not set"}</p>
                        <p>NEXT_PUBLIC_PUBLIC_KEY: {process.env.NEXT_PUBLIC_PUBLIC_KEY ? "Set" : "Not set"}</p>
                    </div>
                </div>

                <div>
                    <h4 className="font-medium mb-2">Upload Test Image:</h4>
                    <ImageUpload onSuccess={handleImageUpload} />
                </div>

                {testImageUrl && (
                    <div>
                        <h4 className="font-medium mb-2">Test Image Display:</h4>
                        <div className="max-w-xs">
                            <Image
                                urlEndpoint={process.env.NEXT_PUBLIC_URI_ENDPOINT as string}
                                src={testImageUrl}
                                alt="Test image"
                                width={200}
                                height={150}
                                className="rounded-lg object-cover"
                            />
                        </div>
                        <p className="text-sm text-gray-600 mt-2">URL: {testImageUrl}</p>
                    </div>
                )}

                <div>
                    <h4 className="font-medium mb-2">Debug Info:</h4>
                    <div className="text-sm bg-gray-100 p-2 rounded">
                        {debugInfo || "No debug info available"}
                    </div>
                </div>

                <Button onClick={testImageDisplay} variant="outline">
                    Test Image Display
                </Button>
            </div>
        </div>
    );
};
