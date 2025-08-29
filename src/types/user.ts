export interface AppUser {
    name?: string | null;
    oauthImage?: string | null;
    imageKitUrl?: string | null;
    isOnline?: boolean;
}
export interface IUser {
    _id: string;
    email: string;
    username?: string;
    profilePicture?: string;
    isOnline?: boolean;
}