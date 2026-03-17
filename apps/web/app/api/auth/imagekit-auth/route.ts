import { getUploadAuthParams } from "@imagekit/next/server";

export async function GET() {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_PUBLIC_KEY;

    if (!privateKey || !publicKey) {
        return Response.json(
            { error: "Image upload is not configured on the server." },
            { status: 500 }
        );
    }

    try {
        const { token, expire, signature } = getUploadAuthParams({
            privateKey,
            publicKey,
        });

        return Response.json({
            token,
            expire,
            signature,
            publicKey,
        });
    } catch {
        return Response.json(
            { error: "ImageKit authentication failed." },
            { status: 500 }
        );
    }
}