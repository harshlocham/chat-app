import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { ImageIcon, MessageSquareDiff } from "lucide-react";
import toast from "react-hot-toast";
import { useConversationStore } from "@/store/chat-store";
import { getMe, getUsers, createConversation, generateUploadUrl } from "@/lib/api";
import { IConversation } from "@/models/Conversation";

// 👇 Import your API handlers (replace with your own)
// <-- your API layer

const UserListDialog = () => {
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [groupName, setGroupName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [renderedImage, setRenderedImage] = useState("");

    const imgRef = useRef<HTMLInputElement>(null);
    const dialogCloseRef = useRef<HTMLButtonElement>(null);

    const { setSelectedConversation } = useConversationStore();

    const [me, setMe] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);

    // 🔁 Load current user and all users
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [meData, userList] = await Promise.all([getMe(), getUsers()]);
                setMe(meData);
                setUsers(userList.filter((u: any) => u._id !== meData._id)); // exclude self
            } catch (err) {
                toast.error("Failed to load users");
                console.error(err);
            }
        };
        fetchData();
    }, []);

    // 🔁 Render selected image
    useEffect(() => {
        if (!selectedImage) return setRenderedImage("");
        const reader = new FileReader();
        reader.onload = (e) => setRenderedImage(e.target?.result as string);
        reader.readAsDataURL(selectedImage);
    }, [selectedImage]);

    const handleCreateConversation = async () => {
        if (selectedUsers.length === 0 || !me?._id) return;
        setIsLoading(true);
        try {
            const isGroup = selectedUsers.length > 1;

            let conversationId;
            if (!isGroup) {
                setIsLoading(true)
                conversationId = await createConversation({
                    participants: [...selectedUsers, me._id],
                    isGroup: false,
                });
            } else {
                setIsLoading(true)
                let imageStorageId = null;
                if (selectedImage) {
                    const { uploadUrl } = await generateUploadUrl();
                    const uploadRes = await fetch(uploadUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": selectedImage.type,
                        },
                        body: selectedImage,
                    });

                    const { storageId } = await uploadRes.json();
                    imageStorageId = storageId;
                }

                conversationId = await createConversation({
                    participants: [...selectedUsers, me._id],
                    isGroup: true,
                    admin: me._id,
                    groupName,
                    groupImage: imageStorageId,
                });
            }

            dialogCloseRef.current?.click();
            setSelectedUsers([]);
            setGroupName("");
            setSelectedImage(null);

            const otherUser = users.find((user) => user._id === selectedUsers[0]);
            const conversationName = isGroup ? groupName : otherUser?.name || otherUser?.email;

            setSelectedConversation({
                _id: conversationId,
                participants: selectedUsers.map((id) => users.find((u) => u._id === id)),
                isGroup,
                image: isGroup ? renderedImage : otherUser?.image,
                name: conversationName,
                admin: me._id,
                type: isGroup ? "group" : "direct",
                _creationTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessage: undefined,
                isOnline: false
            } as IConversation);
            toast.success("Conversation created successfully");
        } catch (err) {
            toast.error("Failed to create conversation");
            console.error(err);
        } finally {
            setIsLoading(false);
            setGroupName("");
            setSelectedImage(null);
        }
    };

    return (
        <Dialog>
            <DialogTrigger>
                <MessageSquareDiff size={20} />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogClose ref={dialogCloseRef} />
                    <DialogTitle>USERS</DialogTitle>
                </DialogHeader>
                <DialogDescription>Start a new chat</DialogDescription>

                {renderedImage && (
                    <div className='w-16 h-16 relative mx-auto'>
                        <Image src={renderedImage} fill alt='group image' className='rounded-full object-cover' />
                    </div>
                )}

                <input
                    type='file'
                    accept='image/*'
                    ref={imgRef}
                    hidden
                    onChange={(e) => setSelectedImage(e.target.files?.[0] ?? null)}
                />

                {selectedUsers.length > 1 && (
                    <>
                        <Input
                            placeholder='Group Name'
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                        <Button onClick={() => imgRef.current?.click()} className='flex gap-2'>
                            <ImageIcon size={20} />
                            Group Image
                        </Button>
                    </>
                )}

                <div className='flex flex-col gap-3 overflow-auto max-h-60'>
                    {users.map((user) => (
                        <div
                            key={user._id}
                            className={`flex gap-3 items-center p-2 rounded cursor-pointer transition-all
                            ${selectedUsers.includes(user._id) ? "bg-[hsl(var(--green-primary))]" : ""}`}
                            onClick={() => {
                                setSelectedUsers((prev) =>
                                    prev.includes(user._id)
                                        ? prev.filter((id) => id !== user._id)
                                        : [...prev, user._id]
                                );
                            }}
                        >
                            <Avatar>
                                {user.isOnline && (
                                    <div className='absolute top-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-foreground' />
                                )}
                                <AvatarImage src={user.image} className='object-cover rounded-full' />
                                <AvatarFallback className='bg-[hsl(var(--gray-tertiary))]' />
                            </Avatar>
                            <p className='text-md font-medium'>{user.username || user.email.split("@")[0]}</p>
                        </div>
                    ))}
                </div>

                <div className='flex justify-between'>
                    <DialogClose asChild>
                        <Button variant={"outline"}>Cancel</Button>
                    </DialogClose>
                    <Button
                        onClick={handleCreateConversation}
                        disabled={selectedUsers.length === 0 || (selectedUsers.length > 1 && !groupName) || isLoading}
                    >
                        {isLoading ? (
                            <div className='w-5 h-5 border-t-2 border-b-2 rounded-full animate-spin' />
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
