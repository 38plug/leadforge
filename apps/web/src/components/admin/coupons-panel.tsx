"use client";

import { useState } from "react";
import { Ticket, Plus, Loader2, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import type { AdminCoupon } from "@/types/api";

/**
 * Discount codes, typically for partnerships and launches.
 *
 * Codes are real, auditable records from the moment they are issued. What they
 * cannot do yet is reduce a bill, because nothing charges money for them to
 * discount — the panel says so rather than implying a code will be honoured at
 * checkout when it will not.
 */
export function AdminCouponsPanel() {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<AdminCoupon[]>("/api/admin/coupons");

  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountKind, setDiscountKind] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await api.post("/api/admin/coupons", {
        code,
        description: description || null,
        percent_off: discountKind === "percent" ? Number(discountValue) : null,
        amount_off_cents: discountKind === "amount" ? Math.round(Number(discountValue) * 100) : null,
        max_redemptions: maxRedemptions ? Number(maxRedemptions) : null,
      });
      toast({ title: "Coupon created", description: code.toUpperCase() , variant: "success" });
      setCode("");
      setDescription("");
      setDiscountValue("");
      setMaxRedemptions("");
      refetch();
    } catch (err) {
      toast({
        title: "Could not create that coupon",
        description: err instanceof ApiError ? err.message : "Please check the values and try again.",
        variant: "error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function revoke(coupon: AdminCoupon) {
    setBusyId(coupon.id);
    try {
      await api.delete(`/api/admin/coupons/${coupon.id}`);
      toast({
        title: "Coupon revoked",
        description: `${coupon.code} can no longer be used.`,
        variant: "success",
      });
      refetch();
    } catch (err) {
      toast({
        title: "Could not revoke that coupon",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  const coupons = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-subtle-foreground" aria-hidden="true" />
            <CardTitle>Create a coupon</CardTitle>
          </div>
          <CardDescription>
            Codes are stored and auditable immediately. They only reduce a bill once a payment
            provider is connected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="coupon-code">Code</label>
              <Input
                id="coupon-code"
                required
                minLength={3}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="PARTNER25"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="coupon-desc">Description</label>
              <Input
                id="coupon-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Partnership launch"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="coupon-kind">Discount</label>
              <Select
                id="coupon-kind"
                value={discountKind}
                onChange={(event) => setDiscountKind(event.target.value as "percent" | "amount")}
              >
                <option value="percent">Percentage off</option>
                <option value="amount">Fixed amount off</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="coupon-value">
                {discountKind === "percent" ? "Percent" : "Amount (USD)"}
              </label>
              <Input
                id="coupon-value"
                type="number"
                required
                min={1}
                max={discountKind === "percent" ? 100 : undefined}
                step={discountKind === "percent" ? 1 : 0.01}
                value={discountValue}
                onChange={(event) => setDiscountValue(event.target.value)}
                placeholder={discountKind === "percent" ? "25" : "10.00"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="label-caps" htmlFor="coupon-max">Max uses</label>
              <div className="flex gap-2">
                <Input
                  id="coupon-max"
                  type="number"
                  min={1}
                  value={maxRedemptions}
                  onChange={(event) => setMaxRedemptions(event.target.value)}
                  placeholder="Unlimited"
                />
                <Button type="submit" disabled={creating || !code || !discountValue}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <CardTitle>Issued coupons</CardTitle>
          <CardDescription>Revoking keeps the record, so an issued code keeps its history.</CardDescription>
        </CardHeader>

        {loading && (
          <div className="p-4">
            <SkeletonRows rows={3} />
          </div>
        )}
        {error && <ErrorState title="Coupons could not be loaded" message={error} onRetry={refetch} />}

        {!loading && !error && coupons.length === 0 && (
          <EmptyState
            icon={Ticket}
            title="No coupons yet"
            description="Create a code above to offer a partner or a launch group a discount."
          />
        )}

        {!loading && !error && coupons.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="label-caps px-4 py-2.5">Code</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Discount</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Used</th>
                  <th scope="col" className="label-caps px-4 py-2.5">Status</th>
                  <th scope="col" className="label-caps px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="row-hover border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-mono text-[13px] font-medium">{coupon.code}</p>
                      {coupon.description && (
                        <p className="text-2xs text-subtle-foreground">{coupon.description}</p>
                      )}
                    </td>
                    <td className="numeric px-4 py-3 text-xs">
                      {coupon.percent_off
                        ? `${coupon.percent_off}%`
                        : coupon.amount_off_cents
                        ? `$${(coupon.amount_off_cents / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="numeric px-4 py-3 text-xs">
                      {coupon.redeemed_count}
                      {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={coupon.is_active ? "success" : "muted"} dot>
                        {coupon.is_active ? "Active" : "Revoked"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {coupon.is_active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === coupon.id}
                          onClick={() => revoke(coupon)}
                        >
                          {busyId === coupon.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" />
                          )}
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
