"use client";

import Link from "next/link";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ColorCodedScriptButton() {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      title="View script breakdown with each scene color-coded by location. Click legend to filter. Print to PDF with background graphics enabled."
    >
      <Link href="/script/color-coded">
        <Palette className="mr-2 h-4 w-4" />
        Color-coded by location
      </Link>
    </Button>
  );
}
