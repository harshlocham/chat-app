import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "../password/hash";

const { otpModel, userModel, registerServiceMock } = vi.hoisted(() => ({
    otpModel: {
        findOne: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
    },
    userModel: {
        findOne: vi.fn(),
    },
    registerServiceMock: vi.fn(),
}));

vi.mock("@/models/OTP", () => ({
    default: otpModel,
}));

vi.mock("@/models/User", () => ({
    User: userModel,
}));

vi.mock("./register.service", () => ({
    registerService: registerServiceMock,
}));

import {
    sendEmailOtpService,
    verifyEmailOtpService,
    verifyOtpAndRegisterService,
} from "./otp.service";

describe("otp.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("blocks OTP send during cooldown", async () => {
        otpModel.findOne.mockResolvedValueOnce({ createdAt: new Date() });

        await expect(
            sendEmailOtpService({
                email: "test@example.com",
                sendOtpEmail: vi.fn(),
            })
        ).rejects.toThrow("Please wait before requesting another OTP");
    });

    it("generates and persists hashed OTP with normalized email", async () => {
        otpModel.findOne.mockResolvedValueOnce(null);
        otpModel.deleteMany.mockResolvedValueOnce({ deletedCount: 0 });
        otpModel.create.mockResolvedValueOnce({ _id: "otp-id" });

        const sendOtpEmail = vi.fn().mockResolvedValue(undefined);

        const result = await sendEmailOtpService({
            email: "  TEST@Example.com ",
            sendOtpEmail,
        });

        expect(result.cooldownMs).toBe(60 * 1000);
        expect(result.expiresInMs).toBe(5 * 60 * 1000);
        expect(otpModel.deleteMany).toHaveBeenCalledWith({ email: "test@example.com" });

        const [createdPayload] = otpModel.create.mock.calls[0];
        expect(createdPayload.email).toBe("test@example.com");
        expect(createdPayload.otp).toEqual(expect.any(String));
        expect(createdPayload.otp).not.toMatch(/^\d{6}$/);

        const [sentEmail, sentOtp] = sendOtpEmail.mock.calls[0];
        expect(sentEmail).toBe("test@example.com");
        expect(sentOtp).toMatch(/^\d{6}$/);
    });

    it("rejects expired OTP and cleans it up", async () => {
        const old = new Date(Date.now() - 6 * 60 * 1000);
        otpModel.findOne.mockResolvedValueOnce({ createdAt: old, otp: "ignored" });
        otpModel.deleteMany.mockResolvedValueOnce({ deletedCount: 1 });

        await expect(
            verifyEmailOtpService({ email: "test@example.com", otp: "123456" })
        ).rejects.toThrow("Invalid or expired OTP");

        expect(otpModel.deleteMany).toHaveBeenCalledWith({ email: "test@example.com" });
    });

    it("rejects invalid OTP", async () => {
        const hashed = await hashPassword("123456");
        otpModel.findOne.mockResolvedValueOnce({
            createdAt: new Date(),
            otp: hashed,
        });

        await expect(
            verifyEmailOtpService({ email: "test@example.com", otp: "000000" })
        ).rejects.toThrow("Invalid or expired OTP");
    });

    it("verifies OTP and registers user when not found", async () => {
        const hashed = await hashPassword("123456");
        otpModel.findOne.mockResolvedValueOnce({
            createdAt: new Date(),
            otp: hashed,
        });
        otpModel.deleteMany.mockResolvedValue({ deletedCount: 1 });

        userModel.findOne.mockResolvedValueOnce(null);
        registerServiceMock.mockResolvedValueOnce({ _id: "u1", email: "test@example.com" });

        const user = await verifyOtpAndRegisterService({
            email: "test@example.com",
            otp: "123456",
            username: "Test User",
            password: "secret123",
        });

        expect(registerServiceMock).toHaveBeenCalledWith({
            username: "Test User",
            email: "test@example.com",
            password: "secret123",
        });
        expect(user).toEqual({ _id: "u1", email: "test@example.com" });
    });

    it("verifies OTP and returns existing user without registering", async () => {
        const hashed = await hashPassword("123456");
        otpModel.findOne.mockResolvedValueOnce({
            createdAt: new Date(),
            otp: hashed,
        });
        otpModel.deleteMany.mockResolvedValue({ deletedCount: 1 });

        const existingUser = { _id: "u2", email: "existing@example.com" };
        userModel.findOne.mockResolvedValueOnce(existingUser);

        const user = await verifyOtpAndRegisterService({
            email: "existing@example.com",
            otp: "123456",
            username: "Existing",
            password: "secret123",
        });

        expect(registerServiceMock).not.toHaveBeenCalled();
        expect(user).toBe(existingUser);
    });
});
