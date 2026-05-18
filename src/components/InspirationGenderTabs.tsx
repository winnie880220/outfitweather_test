export type InspirationGenderFilter = "all" | "女生" | "男生";

const TABS: { id: InspirationGenderFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "女生", label: "女生" },
  { id: "男生", label: "男生" },
];

export function InspirationGenderTabs({
  value,
  onChange,
}: {
  value: InspirationGenderFilter;
  onChange: (next: InspirationGenderFilter) => void;
}) {
  return (
    <div className="inspiration-gender-tabs" role="tablist" aria-label="穿搭性別篩選">
      {TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inspiration-gender-tab${active ? " inspiration-gender-tab--active" : ""}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

