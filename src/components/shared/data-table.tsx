"use client";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** masqué sur mobile */
  hideOnMobile?: boolean;
}

interface Props<T> {
  columns: ColumnDef<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  toolbar?: React.ReactNode;
  page?: number;
  pages?: number;
  total?: number;
  onPage?: (p: number) => void;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  empty?: React.ReactNode;
}

export function DataTable<T>({ columns, rows, loading, search, onSearch, searchPlaceholder = "Rechercher…", toolbar, page = 1, pages = 1, total, onPage, onRowClick, rowKey, empty }: Props<T>) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      {(onSearch || toolbar) && (
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center">
          {onSearch && (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} className="h-9 pl-9" />
            </div>
          )}
          {toolbar && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{toolbar}</div>}
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.key} className={cn(c.hideOnMobile && "hidden md:table-cell", c.className)}>{c.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && !rows &&
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn(c.hideOnMobile && "hidden md:table-cell")}><Skeleton className="h-4 w-full max-w-[160px]" /></TableCell>
                ))}
              </TableRow>
            ))}
          {rows?.map((row, i) => (
            <motion.tr
              key={rowKey(row)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.015, 0.2) }}
              onClick={() => onRowClick?.(row)}
              className={cn("border-b transition-colors hover:bg-muted/40", onRowClick && "cursor-pointer")}
            >
              {columns.map((c) => (
                <TableCell key={c.key} className={cn(c.hideOnMobile && "hidden md:table-cell", c.className)}>{c.cell(row)}</TableCell>
              ))}
            </motion.tr>
          ))}
        </TableBody>
      </Table>
      {rows && rows.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <div className="rounded-2xl bg-muted p-3"><Inbox className="size-6 text-muted-foreground" /></div>
          <p className="text-sm text-muted-foreground">{empty ?? "Aucun élément à afficher"}</p>
        </div>
      )}
      {onPage && pages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">{total !== undefined && `${total} résultat${total > 1 ? "s" : ""} · `}Page {page} / {pages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente"><ChevronLeft /></Button>
            <Button variant="outline" size="icon" className="size-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante"><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
