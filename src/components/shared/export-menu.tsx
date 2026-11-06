"use client";
import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Export PDF / Excel / CSV d'un module. */
export function ExportMenu({ entity }: { entity: string }) {
  const dl = (format: string) => {
    window.location.href = `/api/exports/${entity}?format=${format}`;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Download /> Exporter</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => dl("pdf")}><FileText /> PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => dl("xlsx")}><FileSpreadsheet /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => dl("csv")}><Sheet /> CSV</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
