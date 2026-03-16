function appendImageKitTransform(url: string, size: number): string {
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes("ik.imagekit.io")) {
            return url;
        }

        const existing = parsed.searchParams.get("tr");
        const transform = `w-${size},h-${size},c-maintain_ratio`;
        parsed.searchParams.set("tr", existing ? `${existing},${transform}` : transform);
        return parsed.toString();
    } catch {
        return url;
    }
}

export function getAvatarUrl(source?: string, size = 128): string {
    if (!source) return "";

    if (source.startsWith("http://") || source.startsWith("https://")) {
        return appendImageKitTransform(source, size);
    }

    const endpoint = process.env.NEXT_PUBLIC_URI_ENDPOINT?.replace(/\/$/, "");
    const normalized = source.replace(/^\/+/, "");

    if (!endpoint) {
        return source;
    }

    return appendImageKitTransform(`${endpoint}/${normalized}`, size);
}
