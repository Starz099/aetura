import { Button } from "@/components/ui";
import { Link } from "react-router-dom";
import { CaretLeft } from "@phosphor-icons/react";

const Settings = () => {
  return (
    <div className="w-full">
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Link to="/">
              <CaretLeft size={16} weight="bold" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Appearance Section */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Theme settings are managed from the footer theme toggle.
            </p>
          </div>

          {/* More sections can be added here */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-4 font-semibold">General</h2>
            <p className="text-sm text-muted-foreground">
              Additional settings will be added here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
