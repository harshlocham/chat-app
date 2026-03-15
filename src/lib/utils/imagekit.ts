const TRANSFORM_TEMPLATE = (size: number) =>
    `tr=w-${size},h-${size},fo-auto,q-80,f-webp`;

const appendTransform = (url: string, size: number) => {
    if (!url) return "/placeholder.png";
    if (url.includes("tr=")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${TRANSFORM_TEMPLATE(size)}`;
};

export const getAvatarUrl = (path?: string, size = 128) => {
    if (!path) return "/placeholder.png";

    const safePath = path.trim();
    if (!safePath) return "/placeholder.png";

    if (/^https?:\/\//i.test(safePath)) {
        return appendTransform(safePath, size);
    }

    const endpoint = process.env.NEXT_PUBLIC_URI_ENDPOINT?.replace(/\/+$/, "");
    if (!endpoint) return "/placeholder.png";

    const normalizedPath = safePath.replace(/^\/+/, "");
    return appendTransform(`${endpoint}/${normalizedPath}`, size);
};