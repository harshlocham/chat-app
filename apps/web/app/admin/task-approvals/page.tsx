"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decideTaskApproval, getTaskApprovals, type TaskApprovalRecord } from "@/lib/utils/api";

function formatTimestamp(iso: string) {
    const value = new Date(iso);
    if (Number.isNaN(value.getTime())) return "-";
    return value.toLocaleString();
}

function getPolicySummary(item: TaskApprovalRecord) {
    const after = item.patch?.after as Record<string, unknown> | null;
    const policyDecision = after && typeof after.policyDecision === "object"
        ? (after.policyDecision as Record<string, unknown>)
        : null;

    if (!policyDecision) return "No policy details available.";

    const reasons = Array.isArray(policyDecision.reasons)
        ? policyDecision.reasons.filter((entry): entry is string => typeof entry === "string")
        : [];

    if (reasons.length === 0) return "Approval required by policy.";
    return reasons.join(" ");
}

export default function AdminTaskApprovalsPage() {
    const [approvals, setApprovals] = useState<TaskApprovalRecord[]>([]);
    const [conversationId, setConversationId] = useState("");
    const [loading, setLoading] = useState(false);
    const [actingId, setActingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function loadApprovals() {
        setLoading(true);
        setError(null);
        try {
            const response = await getTaskApprovals(conversationId.trim() || undefined);
            setApprovals(response.approvals);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : "Failed to load approvals");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadApprovals();
    }, []);

    async function decide(item: TaskApprovalRecord, decision: "approve" | "reject") {
        setActingId(item._id);
        setError(null);
        try {
            await decideTaskApproval({
                taskActionId: item._id,
                decision,
            });
            await loadApprovals();
        } catch (decisionError) {
            setError(decisionError instanceof Error ? decisionError.message : "Failed to update approval decision");
        } finally {
            setActingId(null);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Task Approvals</h1>
                    <p className="text-sm text-muted-foreground">Review and govern high-risk execution requests.</p>
                </div>
                <Link href="/admin" className="text-sm underline">Back to admin dashboard</Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Queue Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-3 md:flex-row md:items-end">
                        <label className="flex w-full flex-col gap-1 text-sm">
                            Conversation ID (optional)
                            <Input
                                value={conversationId}
                                onChange={(event) => setConversationId(event.target.value)}
                                placeholder="Filter by conversation"
                            />
                        </label>
                        <Button onClick={() => void loadApprovals()} disabled={loading}>
                            {loading ? "Loading..." : "Refresh"}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Pending Requests ({approvals.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error ? <p className="text-sm text-red-500">{error}</p> : null}

                    {approvals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No pending approvals right now.</p>
                    ) : (
                        approvals.map((item) => (
                            <div key={item._id} className="rounded-lg border p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold">{item.actionType}</p>
                                        <p className="text-xs text-muted-foreground">Task {item.taskId}</p>
                                        <p className="text-xs text-muted-foreground">Conversation {item.conversationId}</p>
                                        <p className="text-xs text-muted-foreground">Requested {formatTimestamp(item.createdAt)}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            onClick={() => void decide(item, "approve")}
                                            disabled={actingId === item._id}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void decide(item, "reject")}
                                            disabled={actingId === item._id}
                                        >
                                            Reject
                                        </Button>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-muted-foreground">{item.summary || "No summary"}</p>
                                <p className="mt-2 text-xs text-amber-600">{getPolicySummary(item)}</p>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
