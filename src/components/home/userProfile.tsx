'use client'
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import UserAvatar from "./UserAvatar";
import { ProfilePictureUpload } from "./ProfilePictureUpload"
import { useEffect, useState } from "react";
import { getMe } from "@/lib/api";
import { IUser } from "@/models/User";
const UserProfile = () => {
    const [user, setUser] = useState<IUser>()
    useEffect(() => {
        async function getUser() {
            try {
                const user = await getMe()
                setUser(user)
            } catch (error) {
                console.log(error)
            }
        }
        getUser()
    }, [])
    const formattedUser = {
        name: user?.username,
        oauthImage: null,
        imageKitUrl: user?.profilePicture,
    };
    //console.log(user)
    return (
        <Dialog >
            <DialogTrigger asChild>
                <Button><UserAvatar
                    user={formattedUser}
                    size={48}
                /></Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--card))] shadow-xl rounded-xl">
                <DialogHeader>
                    <DialogTitle>Change your Profile picture</DialogTitle>
                    <DialogDescription>
                        Upload a new profile picture for your account.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-center py-4">
                    <ProfilePictureUpload onUpdate={() => { }} />
                </div>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default UserProfile