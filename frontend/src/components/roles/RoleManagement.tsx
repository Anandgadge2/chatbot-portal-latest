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
} from "lucide-react";
import toast from "react-hot-toast";

import { apiClient } from "@/lib/api/client";

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
  isSystem: boolean;
  permissions: Permission[];
  userCount?: number;
}

interface RoleManagementProps {
  companyId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Main dashboard and analytics",
    actions: ["view"],
  },
  {
    key: "grievances",
    label: "Grievances",
    description: "Manage grievances/complaints",
    actions: ["view", "create", "update", "delete", "assign", "export"],
  },
  {
    key: "appointments",
    label: "Appointments",
    description: "Manage citizen appointments",
    actions: ["view", "create", "update", "delete", "assign", "export"],
  },
  {
    key: "leads",
    label: "Leads",
    description: "Manage leads and enquiries",
    actions: ["view", "create", "update", "delete", "export"],
  },
  {
    key: "departments",
    label: "Departments",
    description: "Manage departments",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "users",
    label: "User Management",
    description: "Manage users and admins",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "flow_builder",
    label: "Flow Builder",
    description: "Build and edit chatbot flows",
    actions: ["view", "create", "update", "delete"],
  },
  {
    key: "reports",
    label: "Reports",
    description: "View analytics and reports",
    actions: ["view", "export"],
  },
  {
    key: "settings",
    label: "Settings",
    description: "Company settings and config",
    actions: ["view", "update"],
  },
];

const ACTION_LABELS: Record<string, string> = {
  view: "View",
  create: "Add",
  update: "Update",
  delete: "Delete",
  assign: "Assign",
  export: "Export",
};

// ─── Role Management Component ────────────────────────────────────────────────

const RoleManagement: React.FC<RoleManagementProps> = ({ companyId }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  // ─── Form State ─────────────────────────────────────────────────────────────

  const emptyForm = {
    name: "",
    description: "",
    permissions: [] as Permission[],
  };
  const [form, setForm] = useState(emptyForm);

  // ─── Fetch Roles ─────────────────────────────────────────────────────────────

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get(`/roles?companyId=${companyId}`);
      if (data.success) setRoles(data.data.roles);
      else toast.error(data.message || "Failed to fetch roles");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error fetching roles");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // ─── Permissions Helpers ──────────────────────────────────────────────────────

  const hasAction = (module: string, action: string) => {
    const perm = form.permissions.find((p) => p.module === module);
    return perm?.actions.includes(action) ?? false;
  };

  const isModuleFullySelected = (module: string) => {
    const mod = MODULES.find((m) => m.key === module);
    if (!mod) return false;
    return mod.actions.every((a) => hasAction(module, a));
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

  const toggleModule = (module: string) => {
    const mod = MODULES.find((m) => m.key === module);
    if (!mod) return;
    const allSelected = isModuleFullySelected(module);
    setForm((prev) => {
      const perms = prev.permissions.filter((p) => p.module !== module);
      if (!allSelected) perms.push({ module, actions: [...mod.actions] });
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

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description || "",
      permissions: JSON.parse(JSON.stringify(role.permissions)),
    });
    setShowForm(true);
  };

  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

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

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search roles..."
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading roles…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase w-12">
                  SR
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">
                  Name
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
                  <td colSpan={4} className="text-center py-10 text-slate-400">
                    No roles found
                  </td>
                </tr>
              ) : (
                filtered.map((role, i) => (
                  <tr
                    key={role._id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 flex items-center gap-2">
                        {role.name}
                        {role.isSystem && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[9px] font-black uppercase rounded border border-indigo-200">
                            System
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 max-w-xs truncate">
                        {role.description ||
                          (role.isSystem
                            ? "Default system role"
                            : "Custom role")}
                      </div>

                      {/* Permission Badges */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {role.permissions.map((p) => (
                          <span
                            key={p.module}
                            className="px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-bold text-slate-500 border border-slate-200 uppercase"
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
                      <div className="flex items-center gap-1 text-slate-600">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-sm font-medium">
                          {role.userCount ?? 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(role)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {!role.isSystem && (
                          <button
                            onClick={() => handleDelete(role)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Form Header */}
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                  <Shield className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold">
                    {editingRole ? "Edit Role" : "Add New Role"}
                  </h3>
                  <p className="text-slate-400 text-xs">
                    {editingRole
                      ? "Update role permissions"
                      : "Create a new role with custom permissions"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingRole(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                  Basic Information
                </h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="e.g. Finance Supervisor"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Description (Optional)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Brief description of this role"
                    rows={2}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-4">
                <h4 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                  Permissions *{" "}
                  <span className="text-slate-400 font-normal text-xs normal-case">
                    Select the permissions this role should have
                  </span>
                </h4>
                <div className="space-y-3">
                  {MODULES.map((mod) => (
                    <div
                      key={mod.key}
                      className="border border-slate-200 rounded-xl overflow-hidden"
                    >
                      {/* Module Header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <input
                          type="checkbox"
                          id={`mod_${mod.key}`}
                          checked={isModuleFullySelected(mod.key)}
                          onChange={() => toggleModule(mod.key)}
                          className="w-4 h-4 text-indigo-600 rounded"
                        />
                        <label
                          htmlFor={`mod_${mod.key}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-semibold text-slate-800 text-sm">
                            {mod.label}
                          </div>
                          <div className="text-xs text-slate-500">
                            {mod.description}
                          </div>
                        </label>
                      </div>

                      {/* Action Checkboxes */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 px-4 py-3">
                        {mod.actions.map((action) => (
                          <label
                            key={action}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={hasAction(mod.key, action)}
                              onChange={() => toggleAction(mod.key, action)}
                              className="w-3.5 h-3.5 text-indigo-600 rounded"
                            />
                            <span className="text-sm text-slate-600">
                              {ACTION_LABELS[action] || action}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingRole(null);
                  }}
                  className="px-5 py-2.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {editingRole ? "Update Role" : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
