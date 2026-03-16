// File: app/api/upload-auth/route.ts
import { getUploadAuthParams } from "@imagekit/next/server"

export async function GET() {


    try {
        const { token, expire, signature } = getUploadAuthParams({
            privateKey: process.env.IMAGEKIT_PRIVATE_KEY as string,
            publicKey: process.env.NEXT_PUBLIC_PUBLIC_KEY as string,
        })

        return Response.json(
            {
                token,
                expire,
                signature,
                publicKey: process.env.IMAGEKIT_PUBLIC_KEY
            }
        )
    } catch {
        return Response.json(
            { error: "Authentication for imagekit failed" },
            { status: 500 }
        )
    }
}   