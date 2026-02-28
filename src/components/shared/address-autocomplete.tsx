"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AddressSuggestion = {
  formatted: string;
  lat: number | null;
  lon: number | null;
};

type AddressAutocompleteProps = {
  /** Initial address (e.g. from location record) */
  defaultAddress?: string;
  /** Initial latitude (when editing) */
  defaultLatitude?: number | null;
  /** Initial longitude (when editing) */
  defaultLongitude?: number | null;
  /** Form field name for the address */
  name?: string;
  /** Form field name for latitude (hidden input) */
  nameLatitude?: string;
  /** Form field name for longitude (hidden input) */
  nameLongitude?: string;
  /** When false, no autocomplete (plain text input) */
  autocompleteEnabled?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Rows for textarea-style; use 1 for single-line input */
  rows?: number;
  className?: string;
  /** Called when the address value changes (typing or suggestion selection) */
  onAddressChange?: (address: string, lat: number | null, lng: number | null) => void;
};

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

export function AddressAutocomplete({
  defaultAddress = "",
  defaultLatitude = null,
  defaultLongitude = null,
  name = "address",
  nameLatitude = "latitude",
  nameLongitude = "longitude",
  autocompleteEnabled = true,
  placeholder,
  disabled = false,
  rows = 2,
  className,
  onAddressChange
}: AddressAutocompleteProps) {
  const [address, setAddress] = React.useState(defaultAddress);
  const [latitude, setLatitude] = React.useState<number | null>(defaultLatitude ?? null);
  const [longitude, setLongitude] = React.useState<number | null>(defaultLongitude ?? null);
  const [suggestions, setSuggestions] = React.useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState(-1);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setAddress(defaultAddress);
    setLatitude(defaultLatitude ?? null);
    setLongitude(defaultLongitude ?? null);
  }, [defaultAddress, defaultLatitude, defaultLongitude]);

  const fetchSuggestions = React.useCallback(async (text: string) => {
    if (text.length < MIN_CHARS) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const url = `/api/geocode/autocomplete?text=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = (await res.json()) as { results?: AddressSuggestion[] };
      setSuggestions(data.results ?? []);
      setHighlightIndex(-1);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const value = e.target.value;
    setAddress(value);
    onAddressChange?.(value, null, null);
    if (!autocompleteEnabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < MIN_CHARS) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value.trim());
    }, DEBOUNCE_MS);
  };

  const selectSuggestion = (s: AddressSuggestion) => {
    setAddress(s.formatted);
    setLatitude(s.lat);
    setLongitude(s.lon);
    onAddressChange?.(s.formatted, s.lat, s.lon);
    setSuggestions([]);
    setOpen(false);
    setHighlightIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!autocompleteEnabled || !open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : -1));
    } else if (e.key === "Enter" && highlightIndex >= 0 && suggestions[highlightIndex]) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isTextarea = rows > 1;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {isTextarea ? (
        <textarea
          name={name}
          value={address}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      ) : (
        <Input
          name={name}
          type="text"
          value={address}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full"
        />
      )}
      <input type="hidden" name={nameLatitude} value={latitude ?? ""} />
      <input type="hidden" name={nameLongitude} value={longitude ?? ""} />

      {autocompleteEnabled && open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-md"
          role="listbox"
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Searching…
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No addresses found
            </div>
          ) : (
            suggestions.map((s, i) => (
              <button
                key={`${s.formatted}-${i}`}
                type="button"
                role="option"
                aria-selected={i === highlightIndex}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  i === highlightIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
              >
                {s.formatted}
              </button>
            ))
          )}
        </div>
      )}

      {autocompleteEnabled && (
        <p className="mt-1 text-xs text-muted-foreground">
          Start typing for suggestions
        </p>
      )}
    </div>
  );
}
