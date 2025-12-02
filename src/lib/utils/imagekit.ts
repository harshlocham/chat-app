export const getAvatarUrl = (path?: string, size = 128) => {
    if (!path) return "/placeholder.png"; // fallback

    // ImageKit transformation: width & height, crop center, WebP
    if (path.startsWith("http")) {
        return `${path}?tr=w-${size},h-${size},fo-auto,q-80,f-webp`;
    }

    // Else, treat it as relative file path
    return `https://ik.imagekit.io/<your_id>/${path}?tr=w-${size},h-${size},fo-auto,q-80,f-webp`;
};