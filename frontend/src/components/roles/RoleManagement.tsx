"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Users,
  ChevronRight,
  X,
  Check,
  AlertCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isCompanyAdminOrHigher } from "@/lib/permissions";


import { apiClient } from "@/lib/api/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Permission {
  module: string;
  actions: string[];
}

interface Role {
  _id: string;
  roleId: string;
  name: string;
  description?: string;
  key?: string;
  isSystem: boolean;
  permissions: Permission[];
  userCount?: number;
}

interface RoleManagementProps {
  companyId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Redundant MODULES constant removed. Using dynamic 'modules' state.

// ─── ACTION_LABELS ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Add",
  update: "Update",
  delete: "Delete",
  assign: "Assign",
  export: "Export",
  status_change: "Status",
  manage: "Manage",
  all: "All Access",
};

// ─── Role Management Component ────────────────────────────────────────────────

const RoleManagement: React.FC<RoleManagementProps> = ({ companyId }) => {
  const { user: currentUser, refreshUser } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [activeRoleUsers, setActiveRoleUsers] = useState<any[]>([]);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(
    null,
  );
  const [fetchingUsers, setFetchingUsers] = useState(false);

  // -- Bulk Select State --
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // ─── Form State ─────────────────────────────────────────────────────────────

  const emptyForm = {
    name: "",
    description: "",
    permissions: [] as Permission[],
    notificationSettings: {
      email: true,
      whatsapp: true,
    },
  };
  const [form, setForm] = useState(emptyForm);

  // ─── Fetch Modules ───────────────────────────────────────────────────────────

  const fetchModules = useCallback(async () => {
    try {
      const response = await apiClient.get("/modules");
      if (response.success) {
        const mapped = response.data.map(
          (m: {
            key: string;
            name: string;
            description: string;
            permissions: { action: string }[];
          }) => ({
            key: m.key,
            label: m.name,
            description: m.description,
            actions: m.permissions.map((p: { action: string }) => p.action),
          }),
        );
        setModules(mapped);
      }
    } catch (err) {
      console.error("Error fetching modules:", err);
    }
  }, []);

  // ─── Fetch Roles ─────────────────────────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/roles?companyId=${companyId}`);
      if (data.success) {
        setRoles(data.data.roles);
        setSelectedIds(new Set()); // Clear selection on refresh
      } else toast.error(data.message || "Failed to fetch roles");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error fetching roles");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchRoles();
    fetchModules();
  }, [fetchRoles, fetchModules]);

  // -- Bulk Selection Helpers --
  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r._id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    const roleObjects = roles.filter(r => selectedIds.has(r._id));
    
    // Safety check for system roles
    if (roleObjects.some(r => r.isSystem)) {
      toast.error("Some selected items are system roles and cannot be deleted");
      return;
    }

    try {
      setBulkDeleting(true);
      let successCount = 0;
      let failCount = 0;

      for (const id of idsToDelete) {
        try {
          const res = await apiClient.delete(`/roles/${id}`);
          if (res.success) successCount++;
          else failCount++;
        } catch {
          failCount++;
        }
      }

      if (successCount > 0) toast.success(`Successfully deleted ${successCount} roles`);
      if (failCount > 0) toast.error(`Failed to delete ${failCount} roles`);
      
      setShowBulkConfirm(false);
      setSelectedIds(new Set());
      fetchRoles();
    } catch (err) {
      toast.error("Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  // ─── Permissions Helpers ──────────────────────────────────────────────────────

  const hasAction = (module: string, action: string) => {
    const perm = form.permissions.find((p) => p.module === module);
    return perm?.actions.includes(action) ?? false;
  };

  const isModuleFullySelected = (module: string) => {
    const mod = modules.find((m) => m.key === module);
    if (!mod) return false;
    return mod.actions.every((a: string) => hasAction(module, a));
  };

  const toggleAction = (module: string, action: string) => {
    setForm((prev) => {
      const perms = [...prev.permissions];
      const idx = perms.findIndex((p) => p.module === module);
      if (idx === -1) {
        perms.push({ module, actions: [action] });
      } else {
        const curr = perms[idx];
        const newActions = curr.actions.includes(action)
          ? curr.actions.filter((a) => a !== action)
          : [...curr.actions, action];
        if (newActions.length === 0) {
          perms.splice(idx, 1);
        } else {
          perms[idx] = { ...curr, actions: newActions };
        }
      }
      return { ...prev, permissions: perms };
    });
  };

  const toggleModule = (moduleKey: string) => {
    const mod = modules.find((m) => m.key === moduleKey);
    if (!mod) return;

    const fullySelected = isModuleFullySelected(moduleKey);
    setForm((prev) => {
      const perms = [...prev.permissions];
      const idx = perms.findIndex((p) => p.module === moduleKey);

      if (fullySelected) {
        if (idx !== -1) perms.splice(idx, 1);
      } else {
        if (idx === -1) {
          perms.push({ module: moduleKey, actions: [...mod.actions] });
        } else {
          perms[idx].actions = [...mod.actions];
        }
      }
      return { ...prev, permissions: perms };
    });
  };

  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Role name is required");
    try {
      const url = editingRole ? `/roles/${editingRole._id}` : `/roles`;
      const method = editingRole ? "put" : "post";

      const payload = { ...form, companyId };
      const data = await (apiClient as any)[method](url, payload);

      if (data.success) {
        toast.success(editingRole ? "Role updated!" : "Role created!");
        setShowForm(false);
        setEditingRole(null);
        setForm(emptyForm);
        fetchRoles();
        
        // If we edited current user's role, refresh the session
        if (editingRole && currentUser) {
          const currentCustomRoleId = typeof currentUser.customRoleId === 'object' ? (currentUser.customRoleId as any)._id : currentUser.customRoleId;
          if (currentCustomRoleId === editingRole._id || currentUser.role === editingRole.key) {
            refreshUser();
          }
        }
      } else {
        toast.error(data.message || "Failed to save role");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving role");
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) return toast.error("System roles cannot be deleted");
    if (!confirm(`Delete role "${role.name}"? Users will be unassigned.`))
      return;
    try {
      const data = await apiClient.delete(`/roles/${role._id}`);
      if (data.success) {
        toast.success("Role deleted");
        fetchRoles();
      } else {
        toast.error(data.message || "Failed to delete role");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error deleting role");
    }
  };

  const viewUsers = async (role: Role) => {
    try {
      if (!role.userCount || role.userCount === 0) return;

      setSelectedRoleForUsers(role);
      setShowUsersDialog(true);
      setFetchingUsers(true);

      const response = await apiClient.get(`/roles/${role._id}/users`);
      if (response.success) {
        setActiveRoleUsers(response.data);
      } else {
        toast.error("Failed to load users");
      }
    } catch (err) {
      toast.error("Error loading users");
    } finally {
      setFetchingUsers(false);
    }
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      permissions: JSON.parse(JSON.stringify(role.permissions)),
      notificationSettings: (role as any).notificationSettings || {
        email: true,
        whatsapp: true,
      },
    });
    setShowForm(true);
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-900 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">Role Management</h2>
            <p className="text-slate-400 text-sm">
              Manage user roles and permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchRoles()}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingRole(null);
              setForm(emptyForm);
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Role
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles..."
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="px-5 py-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between animate-in slide-in-from-top-2 duration-300 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-xs font-black text-indigo-900 uppercase tracking-tighter">
                Authority Units Selected
              </p>
              <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest">
                Prepare for mass execution
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 px-4 py-2 transition-colors"
            >
              Cancel Selection
            </button>
            {showBulkConfirm ? (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                  Are you absolutely sure?
                </span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
                >
                  {bulkDeleting ? "Executing..." : "Confirm Delete"}
                </button>
                <button
                  onClick={() => setShowBulkConfirm(false)}
                  className="text-slate-400 hover:text-slate-600 p-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBulkConfirm(true)}
                className="bg-red-50 hover:bg-red-600 text-red-600 hover:text-white border border-red-200 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Mass Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {loading && roles.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Loading roles…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-12 text-center">
                  SR
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Name & Description
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Users
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20 text-slate-400">
                    <div className="flex flex-col items-center gap-3">
                      <Shield className="w-10 h-10 text-slate-200" />
                      <div>
                        <p className="font-semibold text-slate-500">
                          No roles found
                        </p>
                        <p className="text-xs">
                          Create a new role or initialize default ones
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((role, i) => (
                  <tr
                    key={role._id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedIds.has(role._id) ? "bg-indigo-50/40" : ""}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(role._id)}
                        onChange={() => toggleOne(role._id)}
                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-[11px] font-black text-slate-400">
                        {i + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        {role.name}
                        {role.isSystem && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-200">
                            System
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 max-w-xs truncate font-medium">
                        {role.description ||
                          (role.isSystem
                            ? "Default system role"
                            : "Custom role")}
                      </div>

                      {/* Permission Badges */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {role.permissions.map((p) => (
                          <span
                            key={p.module}
                            className="px-1.5 py-0.5 bg-slate-50 rounded text-[8px] font-black text-slate-400 border border-slate-200 uppercase tracking-tighter"
                            title={p.actions.join(", ")}
                          >
                            {p.module}
                          </span>
                        ))}
                        {role.permissions.length === 0 && (
                          <span className="text-[9px] text-slate-400 italic">
                            No permissions assigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => viewUsers(role)}
                        disabled={!role.userCount || role.userCount === 0}
                        className={`flex items-center gap-1.5 transition-all group ${
                          role.userCount && role.userCount > 0
                            ? "text-indigo-600 hover:scale-105 active:scale-95 cursor-pointer"
                            : "text-slate-400 cursor-default"
                        }`}
                        title={
                          role.userCount && role.userCount > 0
                            ? "View Associated Personnel"
                            : "No users assigned"
                        }
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            role.userCount && role.userCount > 0
                              ? "bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white"
                              : "bg-slate-100"
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" />
                        </div>
                        <span
                          className={`text-sm font-black ${
                            role.userCount && role.userCount > 0
                              ? "border-b border-dashed border-indigo-200"
                              : ""
                          }`}
                        >
                          {role.userCount ?? 0}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => handleDelete(role)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Form Header */}
            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <Shield className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg uppercase tracking-tight">
                    {editingRole ? "Modify Role" : "Register New Role"}
                  </h3>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                    {editingRole
                      ? "Update authority and access"
                      : "Define custom organizational permissions"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRole(null);
                }}
                className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="p-8 space-y-8 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                    <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">
                      Fundamental Identity
                    </h4>
                  </div>
                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                        Role Designation *
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="e.g. Finance Supervisor"
                        className="w-full h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-bold text-slate-900 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                        Functional Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Define the primary responsibilities and boundaries of this role..."
                        rows={3}
                        className="w-full bg-slate-50 border-slate-200 rounded-xl px-4 py-3 font-medium text-slate-900 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Notification Settings - Super Admin and Company Admin */}
                {isCompanyAdminOrHigher(currentUser) && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                      <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                      <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">
                        Communication Defaults
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all group shadow-sm">
                        <input
                          type="checkbox"
                          checked={form.notificationSettings?.whatsapp ?? true}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              notificationSettings: {
                                ...p.notificationSettings,
                                whatsapp: e.target.checked,
                              },
                            }))
                          }
                          className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-slate-900 uppercase">
                            WhatsApp Notifications
                          </p>
                          <p className="text-[9px] text-slate-500 font-medium">
                            Auto-trigger updates via WhatsApp
                          </p>
                        </div>
                      </label>
 
                      <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer hover:bg-white hover:border-indigo-200 transition-all group shadow-sm">
                        <input
                          type="checkbox"
                          checked={form.notificationSettings?.email ?? true}
                          onChange={(e) =>
                            setForm((p) => ({
                              ...p,
                              notificationSettings: {
                                ...p.notificationSettings,
                                email: e.target.checked,
                              },
                            }))
                          }
                          className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-[11px] font-black text-slate-900 uppercase">
                            Email Notifications
                          </p>
                          <p className="text-[9px] text-slate-500 font-medium">
                            Send status reports via Email
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>
                )}
 
                {/* Permissions */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                      <h4 className="font-black text-slate-800 text-[10px] uppercase tracking-widest">
                        Authority Matrix *
                      </h4>
                    </div>
                    <span className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">
                      Assign granular module access
                    </span>
                  </div>

                  {modules.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-8 text-center space-y-3">
                      <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                      <div>
                        <p className="text-sm font-black text-slate-500 uppercase tracking-tight">
                          No Features Detected
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Please register feature modules first in the Features
                          tab.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {modules.map((mod) => (
                        <div
                          key={mod.key}
                          className="group border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-200 transition-all shadow-sm hover:shadow-md"
                        >
                          {/* Module Header */}
                          <div className="flex items-center gap-4 px-5 py-4 bg-slate-50 group-hover:bg-indigo-50/30 transition-colors">
                            <div className="relative">
                              <input
                                type="checkbox"
                                id={`mod_${mod.key}`}
                                checked={isModuleFullySelected(mod.key)}
                                onChange={() => toggleModule(mod.key)}
                                className="w-5 h-5 text-indigo-600 rounded-lg border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>
                            <label
                              htmlFor={`mod_${mod.key}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="font-black text-slate-900 text-xs uppercase tracking-tight">
                                {mod.label}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium line-clamp-1">
                                {mod.description}
                              </div>
                            </label>
                            {isModuleFullySelected(mod.key) && (
                              <Check className="w-4 h-4 text-emerald-500" />
                            )}
                          </div>

                          {/* Action Checkboxes */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-6 py-4 bg-white">
                            {mod.actions.map((action: string) => (
                              <label
                                key={action}
                                className="flex items-center gap-2.5 cursor-pointer group/action"
                              >
                                <input
                                  type="checkbox"
                                  checked={hasAction(mod.key, action)}
                                  onChange={() => toggleAction(mod.key, action)}
                                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                />
                                <span className="text-[11px] font-bold text-slate-600 group-hover/action:text-indigo-600 uppercase tracking-wide transition-colors">
                                  {ACTION_LABELS[action] || action}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="p-8 border-t border-slate-100 flex justify-end gap-4 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRole(null);
                  }}
                  className="px-8 py-3.5 text-[11px] font-black uppercase tracking-widest border border-slate-200 text-slate-500 rounded-2xl hover:bg-white hover:text-slate-800 transition-all active:scale-95"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="px-10 py-3.5 text-[11px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Check className="w-4.5 h-4.5" />
                  {editingRole ? "Publish Changes" : "Create Authority"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Role Users Directory Dialog */}
      <Dialog open={showUsersDialog} onOpenChange={setShowUsersDialog}>
        <DialogContent className="max-w-xl bg-white rounded-3xl p-0 overflow-hidden border-none shadow-2xl animate-in fade-in zoom-in duration-300">
          <DialogHeader className="bg-slate-900 px-8 py-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                <Users className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <DialogTitle className="text-white font-black text-lg uppercase tracking-tight">
                  Role Directory
                </DialogTitle>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                  Members assigned as {selectedRoleForUsers?.name}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="p-0 max-h-[50vh] overflow-y-auto custom-scrollbar">
            {fetchingUsers ? (
              <div className="p-20 flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Retrieving Member List...
                </p>
              </div>
            ) : activeRoleUsers.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-tight">
                  No Users Found
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeRoleUsers.map((user) => (
                  <div
                    key={user._id}
                    className="px-8 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-black text-xs border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                        {user.firstName?.[0]}
                        {user.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {user.email || user.phone || "No contact info"}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Department
                      </div>
                      <div className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-black text-slate-600 uppercase tracking-tighter shadow-sm">
                        {user.departmentId?.name || "Unassigned"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-8 py-5 border-t border-slate-100 flex justify-end">
            <button
              onClick={() => setShowUsersDialog(false)}
              className="px-8 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
            >
              Close Directory
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleManagement;
