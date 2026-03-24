export class AuthStepUpRequiredError extends Error {
    public readonly code = "AUTH_STEP_UP_REQUIRED";
    public readonly status = 403;
    public readonly reasons: string[];

    constructor(reasons: string[] = []) {
        super("Step-up verification required");
        this.name = "AuthStepUpRequiredError";
        this.reasons = reasons;
    }
}
