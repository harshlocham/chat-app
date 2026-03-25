export class AuthStepUpRequiredError extends Error {
    public readonly code = "AUTH_STEP_UP_REQUIRED";
    public readonly status = 403;
    public readonly reasons: string[];
    public readonly challengeId?: string;
    public readonly userId?: string;

    constructor(reasons: string[] = [], challengeId?: string, userId?: string) {
        super("Step-up verification required");
        this.name = "AuthStepUpRequiredError";
        this.reasons = reasons;
        this.challengeId = challengeId;
        this.userId = userId;
    }
}
