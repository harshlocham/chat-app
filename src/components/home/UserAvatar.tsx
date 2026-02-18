"use client";
import Image from "next/image";


const UserAvatar = ({ profilePicture, username, size = 48 }: { profilePicture?: string, username?: string, size?: number }) => {
    const src = profilePicture;
    const initials = username?.charAt(0).toUpperCase() || "U";

    return (
        <div
            className="relative flex items-center justify-center rounded-full bg-gray-300 overflow-hidden"
            style={{ width: size, height: size }}
        >
            {src ? (
                <Image
                    src={src}
                    alt={username || "User"}
                    fill
                    className="object-cover"
                />
            ) : (
                <span className="text-white font-semibold">{initials}</span>
            )}
        </div>
    );
};

export default UserAvatar;
