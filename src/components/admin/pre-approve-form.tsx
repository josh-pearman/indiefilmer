"use client";

import { useState, useTransition } from "react";
import { preApproveEmail } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PreApproveForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setMessage(null);
    startTransition(async () => {
      const result = await preApproveEmail(email);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `${email.trim().toLowerCase()} has been approved.` });
        setEmail("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="pre-approve-email">Email address</Label>
        <div className="flex gap-2">
          <Input
            id="pre-approve-email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Adding..." : "Approve"}
          </Button>
        </div>
      </div>
      {message && (
        <p className={`text-sm ${message.type === "error" ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
