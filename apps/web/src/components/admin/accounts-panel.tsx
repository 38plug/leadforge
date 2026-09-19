"use client";

import { useState } from "react";
import { Search, Shield, ShieldOff, UserX, UserCheck, Trash2, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorState, SkeletonRows } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { useApi } from "@/lib/use-api";
import { api, ApiError } from "@/lib/api";
import { PlanSelect } from "@/components/admin/plan-select";
import type { AdminUser } from "@/types/api";
import { cn } from "@/lib/utils";

/**
 * Every account on the installation.
 *
 * Deleting is irreversible and takes any workspace the account solely owns
 * with it, so it is confirmed by typing the email address rather than by a
 * dialog someone can dismiss by reflex. The server enforces the same rules
 * regardless of what this screen allows.
 *
 * Plans are edited inline on each workspace chip. The plan is a property of
 * the workspace rather than of the person, so a change made here lands on
 * every member of it - PlanSelect says so before it acts.
 */
export function AdminAccountsPanel({ currentUserId }: { currentUserId: string }) {
  const { toast } = useToast();
  const { data, loading, error, refetch } = useApi<AdminUser[]>("/api/admin/users");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<AdminUser | null>(null);
  const [confirmText, setConfirmText] = useState("");

  async function update(user: AdminUser, changes: Record<string, boolean>, description: string) {
    setBusyId(user.id);
    try {
      await api.patch(`/api/admin/users/${user.id}`, changes);
      toast({ title: description, description: user.email , variant: "success" });
      refetch();
    } catch (err) {
      toast({
        title: "That change was refused",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(user: AdminUser) {
    setBusyId(user.id);
    try {
      await api.delete(`/api/admin/users/${user.id}`);
      toast({ title: "Account deleted", description: user.email , variant: "success" });
      setConfirmingDelete(null);
      setConfirmText("");
      refetch();
    } catch (err) {
      toast({
        title: "Could not delete that account",
        description: err instanceof ApiError ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <SkeletonRows rows={6} />
      </Card>
    );
  }
  if (error) {
    return (
      <Card>
        <ErrorState title="Accounts could not be loaded" message={error} onRetry={refetch} />
      </Card>
    );
  }

  const users = (data ?? []).filter((user) =>
    `${user.email} ${user.full_name ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-border">
        <div>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            {data?.length ?? 0} registered across the platform. A plan can be changed from the
            workspace beside each account — it grants access without taking payment.
          </CardDescription>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            placeholder="Search name or email..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-8"
            aria-label="Search accounts"
          />
        </div>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="label-caps px-4 py-2.5">Account</th>
              <th scope="col" className="label-caps px-4 py-2.5">Workspaces</th>
              <th scope="col" className="label-caps px-4 py-2.5">Status</th>
              <th scope="col" className="label-caps px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isSelf = user.id === currentUserId;
              const busy = busyId === user.id;
              return (
                <tr key={user.id} className="row-hover border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.full_name || "—"}</p>
                    <p className="text-2xs text-subtle-foreground">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.workspaces.length === 0 && (
                        <span className="text-2xs text-subtle-foreground">None</span>
                      )}
                      {user.workspaces.map((workspace) => (
                        <span
                          key={workspace.id}
                          className="flex items-center gap-1.5 rounded-sm border border-border bg-background/50 py-0.5 pl-1.5 pr-0.5 text-2xs text-muted-foreground"
                          title={`${workspace.role} in ${workspace.name}`}
                        >
                          <span className="max-w-[10rem] truncate">{workspace.name}</span>
                          {/* The plan sits on the workspace, so this is the
                              same control as the Workspaces tab, acting on the
                              same thing. Editing it here saves an admin
                              looking up which workspace a person belongs to. */}
                          <PlanSelect
                            compact
                            workspaceId={workspace.id}
                            workspaceName={workspace.name}
                            plan={workspace.plan}
                            memberCount={workspace.member_count}
                            paymentProvider={workspace.payment_provider}
                            onChanged={refetch}
                          />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {user.is_superuser && <Badge variant="default" dot>Admin</Badge>}
                      <Badge variant={user.is_active ? "muted" : "warning"} dot>
                        {user.is_active ? "Active" : "Disabled"}
                      </Badge>
                      {isSelf && <Badge variant="outline">You</Badge>}
                      {/* Several accounts from one place is the signature of
                          someone opening free plans for the weekly allowance.
                          It is not proof - an office shares an address - so
                          this reports rather than accuses. */}
                      {user.accounts_from_same_origin > 1 && (
                        <Badge
                          variant="warning"
                          title={
                            `${user.accounts_from_same_origin} accounts were created from the ` +
                            "same network. That is normal for an office or campus, and is also " +
                            "what usage farming looks like."
                          }
                        >
                          {user.accounts_from_same_origin}&times; same network
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-subtle-foreground" />}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || isSelf}
                        title={isSelf ? "You cannot change your own access" : undefined}
                        onClick={() =>
                          update(
                            user,
                            { is_superuser: !user.is_superuser },
                            user.is_superuser ? "Admin access removed" : "Admin access granted"
                          )
                        }
                      >
                        {user.is_superuser ? (
                          <ShieldOff className="h-3.5 w-3.5" />
                        ) : (
                          <Shield className="h-3.5 w-3.5" />
                        )}
                        {user.is_superuser ? "Revoke" : "Make admin"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy || isSelf}
                        onClick={() =>
                          update(
                            user,
                            { is_active: !user.is_active },
                            user.is_active ? "Account disabled" : "Account enabled"
                          )
                        }
                      >
                        {user.is_active ? (
                          <UserX className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                        {user.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(!isSelf && "text-destructive hover:bg-destructive/10")}
                        disabled={busy || isSelf}
                        onClick={() => {
                          setConfirmingDelete(user);
                          setConfirmText("");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Typing the address, rather than a dismissible dialog: this removes
          the account and any workspace it solely owns, and does not undo. */}
      {confirmingDelete && (
        <div className="border-t border-destructive/25 bg-destructive/[0.06] p-4">
          <p className="text-[13px] font-medium text-destructive">
            Delete {confirmingDelete.email}?
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            This removes the account and any workspace it solely owns, including that workspace&apos;s
            leads. Workspaces shared with other people survive. It cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={confirmingDelete.email}
              aria-label="Type the email address to confirm"
              className="max-w-xs"
            />
            <Button
              size="sm"
              variant="destructive"
              disabled={confirmText !== confirmingDelete.email || busyId === confirmingDelete.id}
              onClick={() => remove(confirmingDelete)}
            >
              Delete permanently
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
