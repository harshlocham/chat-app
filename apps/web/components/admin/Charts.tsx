// src/components/admin/Charts.tsx
"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
    { name: "Mon", messages: 1200 },
    { name: "Tue", messages: 2100 },
    { name: "Wed", messages: 2700 },
    { name: "Thu", messages: 1600 },
    { name: "Fri", messages: 2200 },
    { name: "Sat", messages: 3200 },
    { name: "Sun", messages: 1900 },
];

export function Charts() {
    return (
        <div className="bg-white p-4 rounded-2xl shadow">
            <h2 className="text-lg font-semibold mb-4">Messages Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="messages" stroke="#2563eb" strokeWidth={2} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}