import { AppUser } from "@/types/user";
import Image from "next/image";

interface UserAvatarProps {
    user: AppUser;
    size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 40 }) => {
    const src = user.imageKitUrl || user.oauthImage || null;
    const initials = user.name?.charAt(0).toUpperCase() || "U";

    return (
        <div
            className="relative flex items-center justify-center rounded-full bg-gray-300 overflow-hidden"
            style={{ width: size, height: size }}
        >
            {src ? (
                <Image
                    src={src}
                    alt={user.name || "User"}
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
