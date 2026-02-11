# Module System & Extensibility Guide

This project uses a modular architecture to allow enabling/disabling features (Grievances, Appointments, Leads, etc.) on a per-company basis. This guide explains how the system works and how to add new modules in the future.

## 1. System Overview

The module system relies on three key components:

1.  **`Module` Enum (`frontend/src/lib/permissions.ts` & `backend/src/config/constants.ts`)**: The source of truth for all available module identifiers.
2.  **`AVAILABLE_MODULES` Config (`frontend/src/config/modules.ts`)**: A centralized configuration array that defines module metadata (Display Name, Description, etc.) used in the UI.
3.  **`enabledModules` Array (`Company` Model)**: Stores the list of active modules for each company.

## 2. Best Practices for Adding a New Module

To add a new module (e.g., `SURVEY_MANAGEMENT`), follow these steps:

### Step 1: Define the Module (Backend)

Update `backend/src/config/constants.ts`:

```typescript
export enum Module {
  // ... existing modules
  SURVEY_MANAGEMENT = "SURVEY_MANAGEMENT", // Add your new module
}
```

### Step 2: Define the Module (Frontend)

Update `frontend/src/lib/permissions.ts` to match the backend:

```typescript
export enum Module {
  // ... existing modules
  SURVEY_MANAGEMENT = "SURVEY_MANAGEMENT",
}
```

### Step 3: Register Module Metadata

Update `frontend/src/config/modules.ts`. This automatically adds it to the "Create Company" dialog.

```typescript
export const AVAILABLE_MODULES: ModuleConfig[] = [
  // ... existing modules
  {
    id: Module.SURVEY_MANAGEMENT,
    name: "Survey Management",
    description: "Create and manage citizen surveys",
  },
];
```

### Step 4: Implement Backend Logic

Create your routes and models. **Crucially**, enforce module permissions in your API routes.
Example `backend/src/routes/survey.routes.ts`:

```typescript
router.get("/", async (req, res) => {
  const { companyId } = req.query;
  const company = await Company.findById(companyId);

  if (!company.enabledModules.includes(Module.SURVEY_MANAGEMENT)) {
    return res.status(403).json({ message: "Survey module not enabled" });
  }
  // ... proceed
});
```

### Step 5: Implement Frontend UI with Conditional Rendering

In your dashboards (`dashboard/page.tsx` or `superadmin/company/[id]/page.tsx`), wrap your Tabs, KPI Cards, and Content in module checks.

**Example (Tabs):**

```tsx
{
  user.enabledModules?.includes(Module.SURVEY_MANAGEMENT) && (
    <TabsTrigger value="surveys">Surveys</TabsTrigger>
  );
}
```

**Example (Stats Card):**

```tsx
{
  user.enabledModules?.includes(Module.SURVEY_MANAGEMENT) && (
    <Card>
      <CardTitle>Total Surveys</CardTitle>
      {/* ... stats content */}
    </Card>
  );
}
```

## 3. Future Improvements (Scalability)

If the number of modules grows significantly (15+), consider refactoring the Dashboard to use a **Module Registry Pattern**:

1.  Create a map of `Module -> Component`.
2.  Iterate over `enabledModules` to dynamically render tabs and content instead of hardcoding conditional blocks.

```tsx
// concept (not implemented yet)
const MODULE_COMPONENTS = {
  [Module.GRIEVANCE]: GrievanceDashboard,
  [Module.SURVEY_MANAGEMENT]: SurveyDashboard,
};

{
  availableModules.map((mod) => (
    <TabsContent value={mod.id}>{MODULE_COMPONENTS[mod.id]}</TabsContent>
  ));
}
```

For now, the conditional rendering approach is simple, explicit, and easy to maintain.
