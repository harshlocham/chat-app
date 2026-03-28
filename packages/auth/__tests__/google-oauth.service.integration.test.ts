import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    userFindOneMock,
    userUpdateOneMock,
    userFindOneAndUpdateMock,
    createUserSessionMock,
    generateAccessTokenMock,
} = vi.hoisted(() => ({
    userFindOneMock: vi.fn(),
    userUpdateOneMock: vi.fn(),
    userFindOneAndUpdateMock: vi.fn(),
    createUserSessionMock: vi.fn(),
    generateAccessTokenMock: vi.fn(),
}));

vi.mock("@/models/User", () => ({
    User: {
        findOne: userFindOneMock,
        updateOne: userUpdateOneMock,
        findOneAndUpdate: userFindOneAndUpdateMock,
    },
}));

vi.mock("../session/create-session", () => ({
    createUserSession: createUserSessionMock,
}));

vi.mock("../tokens/generate", () => ({
    generateAccessToken: generateAccessTokenMock,
}));

import { loginWithGoogleCode } from "../services/google-oauth.service";

type MockResponse<T> = {
    ok: boolean;
    status: number;
    json: () => Promise<T>;
    text: () => Promise<string>;
};

function jsonResponse<T>(data: T, status = 200): MockResponse<T> {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
    };
}

function makeUserDoc(overrides?: Partial<any>) {
    return {
        _id: { toString: () => "user-1" },
        email: "user@example.com",
        username: "user",
        role: "user",
        status: "active",
        tokenVersion: 0,
        password: "",
        googleSub: "google-sub-1",
        authProviders: ["google"],
        profilePicture: "",
        isModified: vi.fn(() => false),
        save: vi.fn(async () => undefined),
        ...overrides,
    };
}

describe("google-oauth.service integration", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
        process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";

        userUpdateOneMock.mockResolvedValue({ upsertedCount: 0 });
        userFindOneAndUpdateMock.mockResolvedValue(null);
        generateAccessTokenMock.mockReturnValue("access-token");
        createUserSessionMock.mockResolvedValue({ refreshToken: "refresh-token" });
    });

    it("1) rejects password account login when Google is not linked", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "google-access-token" }))
            .mockResolvedValueOnce(
                jsonResponse({
                    sub: "google-sub-1",
                    email: "user@example.com",
                    email_verified: true,
                    name: "User",
                })
            );
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        userFindOneMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(
            makeUserDoc({
                password: "hashed-password",
                googleSub: "",
                authProviders: ["password"],
            })
            );

        await expect(
            loginWithGoogleCode({
                code: "oauth-code",
                redirectUri: "http://localhost:3000/api/auth/google/callback",
            })
        ).rejects.toThrow("GOOGLE_ACCOUNT_NOT_LINKED");

        expect(userUpdateOneMock).not.toHaveBeenCalled();
        expect(createUserSessionMock).not.toHaveBeenCalled();
    });

    it("2) rejects login when existing linked Google identity mismatches", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "google-access-token" }))
            .mockResolvedValueOnce(
                jsonResponse({
                    sub: "google-sub-B",
                    email: "user@example.com",
                    email_verified: true,
                    name: "User",
                })
            );
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        userFindOneMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(
            makeUserDoc({
                googleSub: "google-sub-A",
                authProviders: ["google"],
            })
            );

        await expect(
            loginWithGoogleCode({
                code: "oauth-code",
                redirectUri: "http://localhost:3000/api/auth/google/callback",
            })
        ).rejects.toThrow("GOOGLE_IDENTITY_MISMATCH");

        expect(userUpdateOneMock).not.toHaveBeenCalled();
        expect(createUserSessionMock).not.toHaveBeenCalled();
    });

    it("3) creates a new Google user on first-time login", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "google-access-token" }))
            .mockResolvedValueOnce(
                jsonResponse({
                    sub: "google-sub-new",
                    email: "new@example.com",
                    email_verified: true,
                    name: "New User",
                    picture: "https://example.com/avatar.png",
                })
            );
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        const createdUser = makeUserDoc({
            _id: { toString: () => "new-user-id" },
            email: "new@example.com",
            username: "New User",
            googleSub: "google-sub-new",
            authProviders: ["google"],
            profilePicture: "https://example.com/avatar.png",
            password: "",
        });

        userUpdateOneMock.mockResolvedValueOnce({ upsertedCount: 1 });
        userFindOneMock
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(createdUser);

        const result = await loginWithGoogleCode({
            code: "oauth-code",
            redirectUri: "http://localhost:3000/api/auth/google/callback",
            userAgent: "test-agent",
            ipAddress: "127.0.0.1",
        });

        expect(userUpdateOneMock).toHaveBeenCalledWith(
            { email: "new@example.com" },
            expect.objectContaining({
                $setOnInsert: expect.objectContaining({
                    email: "new@example.com",
                    googleSub: "google-sub-new",
                    authProviders: ["google"],
                }),
            }),
            { upsert: true }
        );
        expect(generateAccessTokenMock).toHaveBeenCalledWith(
            expect.objectContaining({ sub: "new-user-id", type: "access" })
        );
        expect(createUserSessionMock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "new-user-id" })
        );

        expect(result.user).toBe(createdUser);
        expect(result.accessToken).toBe("access-token");
        expect(result.refreshToken).toBe("refresh-token");
    });

    it("4) logs in successfully when account is already linked", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "google-access-token" }))
            .mockResolvedValueOnce(
                jsonResponse({
                    sub: "google-sub-1",
                    email: "user@example.com",
                    email_verified: true,
                    name: "User",
                })
            );
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        const existingLinkedUser = makeUserDoc({
            _id: { toString: () => "linked-user-id" },
            googleSub: "google-sub-1",
            authProviders: ["google"],
            isModified: vi.fn(() => false),
        });

        userUpdateOneMock.mockResolvedValueOnce({ upsertedCount: 0 });
        userFindOneMock.mockResolvedValueOnce(existingLinkedUser);

        const result = await loginWithGoogleCode({
            code: "oauth-code",
            redirectUri: "http://localhost:3000/api/auth/google/callback",
            userAgent: "test-agent",
            ipAddress: "127.0.0.1",
        });

        expect(userUpdateOneMock).not.toHaveBeenCalled();
        expect(generateAccessTokenMock).toHaveBeenCalledWith(
            expect.objectContaining({ sub: "linked-user-id", type: "access" })
        );
        expect(createUserSessionMock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "linked-user-id" })
        );
        expect(result.user).toBe(existingLinkedUser);
    });

    it("5) resolves account by Google subject even when email changes", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "google-access-token" }))
            .mockResolvedValueOnce(
                jsonResponse({
                    sub: "google-sub-1",
                    email: "new-email@example.com",
                    email_verified: true,
                    name: "User",
                })
            );
        vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

        const existingLinkedUser = makeUserDoc({
            _id: { toString: () => "linked-user-id" },
            email: "old-email@example.com",
            googleSub: "google-sub-1",
            authProviders: ["google"],
        });

        userFindOneMock.mockResolvedValueOnce(existingLinkedUser);

        const result = await loginWithGoogleCode({
            code: "oauth-code",
            redirectUri: "http://localhost:3000/api/auth/google/callback",
            userAgent: "test-agent",
            ipAddress: "127.0.0.1",
        });

        expect(userUpdateOneMock).not.toHaveBeenCalled();
        expect(createUserSessionMock).toHaveBeenCalledWith(
            expect.objectContaining({ userId: "linked-user-id" })
        );
        expect(result.user).toBe(existingLinkedUser);
    });
});
