import { ClientUser } from "@/shared/types/user";
import Image from "next/image";

interface UserAvatarProps {
    user: ClientUser;
    size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ user, size = 40 }) => {
    const src = user.profilePicture;
    const initials = user.username?.charAt(0).toUpperCase() || "U";

    return (
        <div
            className="relative flex items-center justify-center rounded-full bg-gray-300 overflow-hidden"
            style={{ width: size, height: size }}
        >
            {src ? (
                <Image
                    src={src}
                    alt={user.username || "User"}
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
