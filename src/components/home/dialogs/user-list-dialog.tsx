"use client";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { ImageIcon, MessageSquareDiff } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import { useConversationStore } from "@/store/chat-store";
import { getMe, getUsers, createConversation } from "@/lib/api";

import { useEffect, useRef, useState } from "react";
import { UserItem } from "./UserItem";
import { IConversation } from "@/models/Conversation";
import { upload } from "@imagekit/next";
import { IUser } from "@/models/User";

const UserListDialog = () => {
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [renderedImage, setRenderedImage] = useState("");
    const [users, setUsers] = useState<IUser[]>([]);
    const [me, setMe] = useState<IUser>();
    const [isLoading, setIsLoading] = useState(false);

    const dialogCloseRef = useRef<HTMLButtonElement>(null);
    const { setSelectedConversation } = useConversationStore();

    // 🔁 Load users
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [meData, allUsers] = await Promise.all([getMe(), getUsers()]);
                setMe(meData);
                setUsers(allUsers.filter((u: IUser) => u._id !== meData._id));
            } catch {
                toast.error("Failed to load users");
            }
        };
        fetchData();
    }, []);

    // 🖼️ Render preview
    useEffect(() => {
        if (!selectedImage) return setRenderedImage("");
        const reader = new FileReader();
        reader.onload = (e) => setRenderedImage(e.target?.result as string);
        reader.readAsDataURL(selectedImage);
    }, [selectedImage]);

    // 📤 Upload to ImageKit
    const uploadToImageKit = async (file: File) => {
        const authRes = await fetch("/api/auth/imagekit-auth");
        const auth = await authRes.json();
        const publicKey = process.env.NEXT_PUBLIC_PUBLIC_KEY as string;
        console.log(publicKey);
        const result = await upload({
            file,
            fileName: file.name,
            publicKey: publicKey,
            signature: auth.signature,
            token: auth.token,
            expire: auth.expire,
            folder: "chat-group-images",
        });
        console.log(result);
        return result; // usable image URL
    };

    // ➕ Create conversation
    const handleCreateConversation = async () => {
        if (!me?._id || selectedUsers.length === 0) return;
        setIsLoading(true);

        try {
            const isGroup = selectedUsers.length > 1;
            let imageUrl: string | undefined;

            if (isGroup && selectedImage) {
                const res = await uploadToImageKit(selectedImage);
                imageUrl = res.url;
            }
            console.log(imageUrl);

            const conversationId = await createConversation({
                participants: [...selectedUsers, String(me._id)],
                isGroup,
                admin: isGroup ? String(me._id) : undefined,
                groupName: isGroup ? groupName : undefined,
                image: isGroup ? imageUrl : undefined,
            });

            const matchedUsers = selectedUsers
                .map((id) => users.find((u) => String(u._id) === String(id)))
                .filter(Boolean) as IUser[];

            const otherUser = matchedUsers[0];
            const conversationName = isGroup ? groupName : (otherUser?.username || otherUser?.email || "");

            const newConversation = {
                _id: conversationId,
                participants: matchedUsers,
                isGroup,
                image: isGroup ? imageUrl : otherUser?.profilePicture,
                name: conversationName,
                admin: String(me._id),
                type: isGroup ? "group" : "direct",
                _creationTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessage: undefined,
                isOnline: false,
            };

            // Fix: Ensure newConversation is of type IConversation
            setSelectedConversation(newConversation as IConversation);
            dialogCloseRef.current?.click();

            setSelectedUsers([]);
            setGroupName("");
            setSelectedImage(null);

            toast.success("Conversation created successfully");
        } catch (error) {
            console.log("Failed to create conversation", error);
            toast.error("Failed to create conversation");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog>
            <DialogTrigger>
                <MessageSquareDiff size={20} />
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--card))] shadow-xl rounded-xl">
                <DialogHeader>
                    <DialogClose ref={dialogCloseRef} />
                    <DialogTitle>Users</DialogTitle>
                </DialogHeader>
                <DialogDescription>Start a new chat</DialogDescription>

                {renderedImage && (
                    <div className="w-16 h-16 relative mx-auto">
                        <Image src={renderedImage} fill alt="Group Image" className="rounded-full object-cover" />
                    </div>
                )}

                {selectedUsers.length > 1 && (
                    <>
                        <Input
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Group name"
                        />
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            id="group-image-input"
                            onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                        />
                        <Button
                            className="flex gap-2"
                            onClick={() => document.getElementById("group-image-input")?.click()}
                        >
                            <ImageIcon size={20} />
                            Upload Group Image
                        </Button>
                    </>
                )}

                <div className="flex flex-col gap-3 overflow-auto max-h-60 ">
                    {users.map((user) => (
                        <UserItem
                            key={String(user._id)}
                            user={user}
                            selected={selectedUsers.includes(String(user._id))} // 👈 selectedUsers is a string array
                            onClick={() =>
                                setSelectedUsers((prev) =>
                                    prev.includes(String(user._id))
                                        ? prev.filter((id) => id !== String(user._id))
                                        : [...prev, String(user._id)]
                                )
                            }
                        />
                    ))}
                </div>

                <div className="flex justify-between">
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                        onClick={handleCreateConversation}
                        disabled={
                            selectedUsers.length === 0 ||
                            (selectedUsers.length > 1 && !groupName) ||
                            isLoading
                        }
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-t-2 border-b-2 rounded-full animate-spin" />
                        ) : (
                            "Create"
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default UserListDialog;
