"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Scale } from "lucide-react";

import { useBodyWeight } from "@/entities/user/model/use-body-weight";
import { Button } from "@/components/ui/button";
import { useI18n } from "locales/client";

export function BodyWeightInput() {
  const t = useI18n();
  const queryClient = useQueryClient();
  const { data, isLoading } = useBodyWeight();
  const [weight, setWeight] = useState("");
  const [unit, setUnit] = useState<"kg" | "lbs">("kg");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setWeight(data.weight ? String(data.weight) : "");
      setUnit(data.unit);
    }
  }, [data]);

  const handleSave = async () => {
    const w = parseFloat(weight);
    if (!w || w < 1) return;
    setSaving(true);
    try {
      await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bodyWeight: w, bodyWeightUnit: unit }),
      });
      await queryClient.invalidateQueries({ queryKey: ["user-body-weight"] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-base-100 rounded-lg px-4 py-3 border border-base-200">
      <Scale className="w-5 h-5 text-base-content/60 shrink-0" />
      <span className="text-sm font-medium text-base-content/80 shrink-0">{t("profile.body_weight")}</span>
      <div className="flex items-center gap-1 ml-auto">
        <input
          className="border border-base-300 rounded px-2 py-1.5 w-20 text-center font-bold text-base bg-base-100"
          disabled={isLoading || saving}
          inputMode="decimal"
          onChange={(e) => setWeight(e.target.value)}
          placeholder="0"
          type="number"
          value={weight}
        />
        <select
          className="border border-base-300 rounded px-1 py-1.5 text-sm font-bold bg-base-100"
          disabled={saving}
          onChange={(e) => setUnit(e.target.value as "kg" | "lbs")}
          value={unit}
        >
          <option value="kg">kg</option>
          <option value="lbs">lbs</option>
        </select>
        <Button disabled={saving || !weight} onClick={handleSave} size="sm" variant="default">
          {saving ? "..." : t("commons.save")}
        </Button>
      </div>
    </div>
  );
}
