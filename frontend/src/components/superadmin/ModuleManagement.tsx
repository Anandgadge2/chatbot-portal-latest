"use client";

import React, { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Trash2,
  Edit2,
  Shield,
  Check,
  X,
  Box,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";

interface ModulePermission {
  action: string;
  label: string;
}

interface Module {
  _id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  permissions: ModulePermission[];
  icon?: string;
  isSystem: boolean;
}

export default function ModuleManagement() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [syncing, setSyncing] = useState(false);

  // Form State
  const initialForm = {
    key: "",
    name: "",
    description: "",
    category: "CORE",
    permissions: [{ action: "view", label: "View" }] as ModulePermission[],
    icon: "Box",
  };
  const [form, setForm] = useState(initialForm);

  const fetchModules = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/modules");
      if (response.success) {
        setModules(response.data);
      }
    } catch (err) {
      toast.error("Failed to fetch modules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.key || !form.name)
      return toast.error("Key and Name are required");

    try {
      const url = editingModule ? `/modules/${editingModule._id}` : "/modules";
      const method = editingModule ? "put" : "post";

      const response = await (apiClient as any)[method](url, form);
      if (response.success) {
        toast.success(editingModule ? "Module updated" : "Module created");
        setShowForm(false);
        setEditingModule(null);
        setForm(initialForm);
        fetchModules();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Error saving module");
    }
  };

  const handleDelete = async (module: Module) => {
    if (module.isSystem) return toast.error("System modules cannot be deleted");
    if (
      !confirm(
        `Delete module "${module.name}"? This may affect roles using it.`,
      )
    )
      return;

    try {
      const response = await apiClient.delete(`/modules/${module._id}`);
      if (response.success) {
        toast.success("Module deleted");
        fetchModules();
      }
    } catch (err: any) {
      toast.error("Failed to delete module");
    }
  };

  const addPermission = () => {
    setForm((p) => ({
      ...p,
      permissions: [...p.permissions, { action: "", label: "" }],
    }));
  };

  const updatePermission = (
    index: number,
    field: keyof ModulePermission,
    value: string,
  ) => {
    setForm((p) => {
      const perms = [...p.permissions];
      perms[index] = { ...perms[index], [field]: value };
      return { ...p, permissions: perms };
    });
  };

  const removePermission = (index: number) => {
    setForm((p) => ({
      ...p,
      permissions: p.permissions.filter((_, i) => i !== index),
    }));
  };

  const openEdit = (mod: Module) => {
    setEditingModule(mod);
    setForm({
      key: mod.key,
      name: mod.name,
      description: mod.description,
      category: mod.category,
      permissions: mod.permissions,
      icon: mod.icon || "Box",
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
            Feature Modules
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
            Manage platform-wide capabilities and permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {/* <button
            onClick={async () => {
              try {
                setSyncing(true);
                const res = await apiClient.post("/modules/sync-all");
                if (res.success) {
                  toast.success("System-wide sync complete!");
                  fetchModules();
                }
              } catch (err) {
                toast.error("Global sync failed");
              } finally {
                setSyncing(false);
              }
            }}
            disabled={syncing}
            className="flex items-center gap-2 h-10 px-4 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl font-black text-[14px] uppercase tracking-widest hover:bg-emerald-100 transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            Global Sync
          </button> */}
          <Button
            onClick={() => {
              setEditingModule(null);
              setForm(initialForm);
              setShowForm(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 font-black text-[15px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4 mr-2" />
            Register Feature
          </Button>
        </div>
      </div>

      <div>
        {modules.length === 0 && !loading ? (
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
              <Box className="w-8 h-8 text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-400 uppercase tracking-tight">
                No Features Registered
              </h3>
              <p className="text-slate-400 text-sm max-w-xs font-medium">
                Register custom features or initialize the system with default
                core modules.
              </p>
            </div>
            <Button
              onClick={async () => {
                try {
                  setLoading(true);
                  const res = await apiClient.post("/modules/seed");
                  if (res.success) {
                    toast.success("Default modules seeded!");
                    fetchModules();
                  }
                } catch (err) {
                  toast.error("Failed to seed modules");
                } finally {
                  setLoading(false);
                }
              }}
              variant="outline"
              className="mt-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50 font-black text-[14px] uppercase tracking-widest px-8 rounded-xl h-10 transition-all active:scale-95"
            >
              Initialize Default Modules
            </Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-500">
            {modules.map((mod) => (
              <Card
                key={mod._id}
                className="relative overflow-hidden group hover:shadow-xl transition-all border-slate-200 rounded-2xl"
              >
                <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                        <Box className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-tight">
                          {mod.name}
                        </CardTitle>
                        <CardDescription className="text-[14px] font-bold text-slate-400 uppercase tracking-widest">
                          {mod.key}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1 transition-opacity">
                      <button
                        onClick={() => openEdit(mod)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {!mod.isSystem && (
                        <button
                          onClick={() => handleDelete(mod)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {mod.description}
                  </p>

                  <div className="space-y-2">
                    <div className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
                      Capabilities ({mod.permissions.length})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.permissions.map((p, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-50 text-[15px] font-black text-slate-600 rounded-md border border-slate-100 uppercase tracking-wider"
                        >
                          {p.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {mod.isSystem && (
                    <div className="pt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[14px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest">
                        <Shield className="w-2.5 h-2.5 mr-1" /> System Core
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-[14px] font-black text-slate-500 uppercase tracking-widest">
                    Feature
                  </th>
                  <th className="text-left px-6 py-4 text-[14px] font-black text-slate-500 uppercase tracking-widest">
                    Internal Key
                  </th>
                  <th className="text-left px-6 py-4 text-[14px] font-black text-slate-500 uppercase tracking-widest">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-[14px] font-black text-slate-500 uppercase tracking-widest">
                    Capabilities
                  </th>
                  <th className="text-right px-6 py-4 text-[14px] font-black text-slate-500 uppercase tracking-widest">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modules.map((mod) => (
                  <tr
                    key={mod._id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500">
                          <Box className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {mod.name}
                          </p>
                          <p className="text-[14px] text-slate-400 line-clamp-1 max-w-[200px]">
                            {mod.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <code className="text-[14px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold uppercase tracking-tight">
                        {mod.key}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-slate-50 text-[15px] font-black text-slate-500 rounded border border-slate-100 uppercase tracking-widest">
                        {mod.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-700">
                          {mod.permissions.length}
                        </span>
                        <span className="text-[15px] font-black text-slate-400 uppercase tracking-widest">
                          Actions
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {mod.isSystem && (
                          <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-[14px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-widest">
                            <Shield className="w-2.5 h-2.5 mr-1" /> System
                          </span>
                        )}
                        <button
                          onClick={() => openEdit(mod)}
                          className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-all"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!mod.isSystem && (
                          <button
                            onClick={() => handleDelete(mod)}
                            className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                  <Plus className="w-6 h-6 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg uppercase tracking-tight">
                    {editingModule ? "Update Feature" : "Register New Feature"}
                  </h3>
                  <p className="text-slate-400 text-[14px] font-bold uppercase tracking-widest">
                    Define platform capabilities and granular actions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar"
            >
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-1">
                    Internal Key
                  </Label>
                  <Input
                    disabled={!!editingModule}
                    value={form.key}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        key: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="E.G. ASSET_MANAGER"
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-indigo-500 uppercase"
                  />
                  <p className="text-[15px] text-slate-400 font-medium px-1 italic">
                    Used for code-level permission checks
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-1">
                    Display Name
                  </Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="E.G. Asset Manager"
                    className="h-12 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-1">
                  Feature Description
                </Label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, description: e.target.value }))
                  }
                  placeholder="Explain what this feature does..."
                  className="bg-slate-50 border-slate-200 rounded-xl font-medium text-slate-900 focus:ring-indigo-500 min-h-[100px]"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <Label className="text-[14px] font-black text-slate-500 uppercase tracking-widest px-1">
                    Granular Capabilities
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={addPermission}
                    className="h-7 text-[15px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Action
                  </Button>
                </div>

                <div className="space-y-3">
                  {form.permissions.map((perm, idx) => (
                    <div
                      key={idx}
                      className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-200"
                    >
                      <div className="flex-1 grid grid-cols-2 gap-3">
                        <Input
                          placeholder="Action Slug (e.g. create)"
                          value={perm.action}
                          onChange={(e) =>
                            updatePermission(
                              idx,
                              "action",
                              e.target.value.toLowerCase(),
                            )
                          }
                          className="h-10 bg-slate-50 border-slate-200 rounded-lg text-xs font-bold"
                        />
                        <Input
                          placeholder="Display Label (e.g. Create Asset)"
                          value={perm.label}
                          onChange={(e) =>
                            updatePermission(idx, "label", e.target.value)
                          }
                          className="h-10 bg-slate-50 border-slate-200 rounded-lg text-xs font-bold"
                        />
                      </div>
                      {form.permissions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePermission(idx)}
                          className="mt-2 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4 sticky bottom-0 bg-white">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="flex-1 h-12 rounded-2xl border-slate-200 font-black text-[15px] uppercase tracking-widest"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-2 h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[15px] uppercase tracking-widest px-12 transition-all shadow-lg shadow-indigo-600/20"
                >
                  <Check className="w-4.5 h-4.5 mr-2" />
                  {editingModule ? "Save Changes" : "Confirm Registration"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
