"use client";

import { useState, useRef, useEffect } from "react";
import { submitIntakeForm } from "@/actions/intake";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface IntakeFormProps {
  token: string;
  projectName: string;
  roleName: string;
  defaultValues: {
    name: string;
    phone: string;
    email: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
    emergencyContactRelation: string;
    dietaryRestrictions: string;
    includePhoneOnCallSheet: boolean;
    includeEmailOnCallSheet: boolean;
  };
}

export function IntakeForm({ token, projectName, roleName, defaultValues }: IntakeFormProps) {
  const [name, setName] = useState(defaultValues.name);
  const [phone, setPhone] = useState(defaultValues.phone);
  const [email, setEmail] = useState(defaultValues.email);
  const [emergencyContactName, setEmergencyContactName] = useState(defaultValues.emergencyContactName);
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(defaultValues.emergencyContactPhone);
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(defaultValues.emergencyContactRelation);
  const [dietaryRestrictions, setDietaryRestrictions] = useState(defaultValues.dietaryRestrictions);
  const [includePhoneOnCallSheet, setIncludePhoneOnCallSheet] = useState(defaultValues.includePhoneOnCallSheet);
  const [includeEmailOnCallSheet, setIncludeEmailOnCallSheet] = useState(defaultValues.includeEmailOnCallSheet);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const touchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (submitted) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/intake/${token}`);
        if (!res.ok) return;
        const data = await res.json();
        const setters: Record<string, (v: string) => void> = {
          name: setName,
          phone: setPhone,
          email: setEmail,
          emergencyContactName: setEmergencyContactName,
          emergencyContactPhone: setEmergencyContactPhone,
          emergencyContactRelation: setEmergencyContactRelation,
          dietaryRestrictions: setDietaryRestrictions,
        };
        for (const [field, setter] of Object.entries(setters)) {
          if (!touchedRef.current.has(field) && data[field] !== undefined) {
            setter(data[field]);
          }
        }
        if (!touchedRef.current.has("includePhoneOnCallSheet") && data.includePhoneOnCallSheet !== undefined) {
          setIncludePhoneOnCallSheet(data.includePhoneOnCallSheet);
        }
        if (!touchedRef.current.has("includeEmailOnCallSheet") && data.includeEmailOnCallSheet !== undefined) {
          setIncludeEmailOnCallSheet(data.includeEmailOnCallSheet);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token, submitted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await submitIntakeForm(token, {
      name,
      phone,
      email,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      dietaryRestrictions,
      includePhoneOnCallSheet: String(includePhoneOnCallSheet),
      includeEmailOnCallSheet: String(includeEmailOnCallSheet),
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <h2 className="text-lg font-semibold mb-2">Thank you!</h2>
          <p className="text-sm text-muted-foreground">
            Your information has been submitted for {projectName}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const inputClass =
    "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Your Info</CardTitle>
        <CardDescription>
          for {roleName} on {projectName}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); touchedRef.current.add("name"); }}
              className={inputClass}
              placeholder="Your full name"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="phone" className="text-sm font-medium">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); touchedRef.current.add("phone"); }}
              className={inputClass}
              placeholder="Phone number"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includePhoneOnCallSheet}
                onChange={(e) => { setIncludePhoneOnCallSheet(e.target.checked); touchedRef.current.add("includePhoneOnCallSheet"); }}
                className="rounded border-border"
              />
              Include on call sheet {!includePhoneOnCallSheet && <span className="text-muted-foreground">(not required)</span>}
            </label>
            {includePhoneOnCallSheet && (
              <p className="ml-6 text-xs text-destructive">
                Your phone number will be visible to the entire crew on the call sheet.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); touchedRef.current.add("email"); }}
              className={inputClass}
              placeholder="Email address"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeEmailOnCallSheet}
                onChange={(e) => { setIncludeEmailOnCallSheet(e.target.checked); touchedRef.current.add("includeEmailOnCallSheet"); }}
                className="rounded border-border"
              />
              Include on call sheet {!includeEmailOnCallSheet && <span className="text-muted-foreground">(not required)</span>}
            </label>
            {includeEmailOnCallSheet && (
              <p className="ml-6 text-xs text-destructive">
                Your email will be visible to the entire crew on the call sheet.
              </p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="pt-2">
            <p className="text-sm font-medium text-muted-foreground border-b border-border pb-1 mb-3">
              Emergency Contact
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergencyContactName" className="text-sm font-medium">
              Emergency Contact Name
            </label>
            <input
              id="emergencyContactName"
              type="text"
              value={emergencyContactName}
              onChange={(e) => { setEmergencyContactName(e.target.value); touchedRef.current.add("emergencyContactName"); }}
              className={inputClass}
              placeholder="Contact name"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergencyContactPhone" className="text-sm font-medium">
              Emergency Contact Phone
            </label>
            <input
              id="emergencyContactPhone"
              type="tel"
              value={emergencyContactPhone}
              onChange={(e) => { setEmergencyContactPhone(e.target.value); touchedRef.current.add("emergencyContactPhone"); }}
              className={inputClass}
              placeholder="Contact phone"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="emergencyContactRelation" className="text-sm font-medium">
              Emergency Contact Relationship
            </label>
            <input
              id="emergencyContactRelation"
              type="text"
              value={emergencyContactRelation}
              onChange={(e) => { setEmergencyContactRelation(e.target.value); touchedRef.current.add("emergencyContactRelation"); }}
              className={inputClass}
              placeholder="e.g. Spouse, Parent, Friend"
            />
          </div>

          {/* Other */}
          <div className="pt-2">
            <p className="text-sm font-medium text-muted-foreground border-b border-border pb-1 mb-3">
              Other
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="dietaryRestrictions" className="text-sm font-medium">
              Dietary Restrictions
            </label>
            <textarea
              id="dietaryRestrictions"
              value={dietaryRestrictions}
              onChange={(e) => { setDietaryRestrictions(e.target.value); touchedRef.current.add("dietaryRestrictions"); }}
              className={`${inputClass} min-h-[80px] resize-y`}
              placeholder="Any dietary restrictions or allergies"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
