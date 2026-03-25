import ChallengeForm from "./ChallengeForm";

type ChallengePageProps = {
    searchParams?: {
        cid?: string;
        next?: string;
    };
};

function sanitizeNextPath(nextPath?: string): string {
    if (!nextPath || typeof nextPath !== "string") {
        return "/dashboard";
    }

    if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
        return "/dashboard";
    }

    return nextPath;
}

export default function ChallengePage({ searchParams }: ChallengePageProps) {
    const challengeId = searchParams?.cid || "";
    const nextPath = sanitizeNextPath(searchParams?.next);

    return (
        <main className="min-h-screen bg-[hsl(var(--background))] px-4 py-10 sm:px-6">
            <div className="mx-auto w-full max-w-md rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-sm sm:p-8">
                <h1 className="text-xl font-semibold text-[hsl(var(--foreground))] sm:text-2xl">
                    Step-up verification
                </h1>
                <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                    We detected unusual activity. Please verify your identity.
                </p>

                <div className="mt-6">
                    <ChallengeForm challengeId={challengeId} nextPath={nextPath} />
                </div>
            </div>
        </main>
    );
}
