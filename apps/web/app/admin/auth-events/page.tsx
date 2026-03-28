"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    getAdminAuthEvents,
    type AdminAuthEvent,
    type AdminAuthEventType,
} from "@/lib/utils/api";

const EVENT_TYPES: Array<{ label: string; value: AdminAuthEventType | "ALL" }> = [
    { label: "All events", value: "ALL" },
    { label: "LOGIN", value: "LOGIN" },
    { label: "REFRESH", value: "REFRESH" },
    { label: "REVOKE", value: "REVOKE" },
    { label: "STEP_UP", value: "STEP_UP" },
];

const PAGE_SIZE = 20;

function formatTimestamp(iso: string): string {
    const value = new Date(iso);
    if (Number.isNaN(value.getTime())) return "-";
    return value.toLocaleString();
}

function truncate(value: string, max = 64): string {
    if (!value) return "-";
    if (value.length <= max) return value;
    return `${value.slice(0, max)}...`;
}

export default function AdminAuthEventsPage() {
    const [events, setEvents] = useState<AdminAuthEvent[]>([]);
    const [eventType, setEventType] = useState<AdminAuthEventType | "ALL">("ALL");
    const [date, setDate] = useState("");
    const [userId, setUserId] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const activeFilters = useMemo(
        () => ({
            page,
            limit: PAGE_SIZE,
            eventType: eventType === "ALL" ? undefined : eventType,
            date: date || undefined,
            userId: userId.trim() || undefined,
        }),
        [date, eventType, page, userId]
    );

    useEffect(() => {
        let isMounted = true;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                const response = await getAdminAuthEvents(activeFilters);
                if (!isMounted) return;
                setEvents(response.events);
                setTotalPages(response.pagination.totalPages);
                setTotal(response.pagination.total);
            } catch (loadError) {
                if (!isMounted) return;
                setError(loadError instanceof Error ? loadError.message : "Failed to load auth events");
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        void load();

        return () => {
            isMounted = false;
        };
    }, [activeFilters]);

    function applyFilters() {
        setPage(1);
    }

    function clearFilters() {
        setEventType("ALL");
        setDate("");
        setUserId("");
        setPage(1);
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Authentication Events</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-4">
                        <label className="flex flex-col gap-1 text-sm">
                            Event type
                            <select
                                className="h-10 rounded-md border border-input bg-background px-3"
                                value={eventType}
                                onChange={(e) => setEventType(e.target.value as AdminAuthEventType | "ALL")}
                            >
                                {EVENT_TYPES.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1 text-sm">
                            Date
                            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </label>

                        <label className="flex flex-col gap-1 text-sm">
                            User ID
                            <Input
                                placeholder="Filter by user ID"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                            />
                        </label>

                        <div className="flex items-end gap-2">
                            <Button onClick={applyFilters}>Apply</Button>
                            <Button variant="outline" onClick={clearFilters}>
                                Clear
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Event Log ({total})</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    {error ? <p className="text-sm text-red-500">{error}</p> : null}

                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b text-left">
                                <th className="p-2">Group</th>
                                <th className="p-2">Event</th>
                                <th className="p-2">Outcome</th>
                                <th className="p-2">User ID</th>
                                <th className="p-2">Timestamp</th>
                                <th className="p-2">Reason</th>
                                <th className="p-2">IP Address</th>
                                <th className="p-2">User Agent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td className="p-3" colSpan={8}>
                                        Loading...
                                    </td>
                                </tr>
                            ) : events.length === 0 ? (
                                <tr>
                                    <td className="p-3" colSpan={8}>
                                        No events found for current filters.
                                    </td>
                                </tr>
                            ) : (
                                events.map((event) => (
                                    <tr key={event.id} className="border-b">
                                        <td className="p-2 font-medium">{event.eventType}</td>
                                        <td className="p-2">{event.eventName}</td>
                                        <td className="p-2">{event.outcome}</td>
                                        <td className="p-2">{event.userId || "-"}</td>
                                        <td className="p-2">{formatTimestamp(event.timestamp)}</td>
                                        <td className="p-2" title={event.reason || ""}>
                                            {event.reason ? truncate(event.reason, 72) : "-"}
                                        </td>
                                        <td className="p-2">{event.ipAddress || "unknown"}</td>
                                        <td className="p-2" title={event.userAgent}>
                                            {truncate(event.userAgent, 96)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className="mt-4 flex items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1 || loading}
                        >
                            Previous
                        </Button>
                        <span className="text-sm">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages || loading}
                        >
                            Next
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
